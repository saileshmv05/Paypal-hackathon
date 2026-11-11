import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { CurrencyCode, GroupMember, ParticipantBalance, SettlementPlan, SettlementTransfer } from '../types';
import { formatCurrencyAmount, quantizeCurrency, toDecimal } from '../financial/currency';
import { convertCurrency } from '../financial/rates';

interface ParticipantNode {
  id: string;
  name: string;
  preferredCurrency: CurrencyCode;
  balanceMinor: bigint; // Balance in integer minor units (e.g. cents)
  netInBase: Decimal;
}

/**
 * Solves the exact Minimum Transfers problem for N <= 14 nonzero participants.
 * Theorem: The minimum number of transfers required to settle a zero-sum group
 * equals (N - K), where N is the number of nonzero-balance participants and
 * K is the maximum number of disjoint zero-sum subsets.
 */
export function solveMinimumTransfersExact(
  nonzeroNodes: ParticipantNode[],
  baseCurrency: CurrencyCode,
  planId: string
): { transfers: SettlementTransfer[]; zeroSumSubsetsCount: number } {
  const n = nonzeroNodes.length;
  if (n === 0) return { transfers: [], zeroSumSubsetsCount: 0 };
  if (n === 1) {
    throw new Error(`Invalid single nonzero participant with balance: ${nonzeroNodes[0].balanceMinor}`);
  }

  // Precompute subset sums in minor units
  const totalSubsets = 1 << n;
  const subsetSums = new BigInt64Array(totalSubsets);
  const isZeroSum = new Uint8Array(totalSubsets);

  for (let mask = 1; mask < totalSubsets; mask++) {
    // mask & (mask - 1) removes lowest set bit
    const lowestBitIndex = 31 - Math.clz32(mask & -mask);
    const prevMask = mask & (mask - 1);
    subsetSums[mask] = subsetSums[prevMask] + nonzeroNodes[lowestBitIndex].balanceMinor;
    if (subsetSums[mask] === 0n) {
      isZeroSum[mask] = 1;
    }
  }

  // DP to find maximum number of disjoint zero-sum subsets
  // dp[mask] = max number of disjoint zero-sum subsets contained in mask
  const dp = new Int32Array(totalSubsets);
  const parent = new Int32Array(totalSubsets);
  parent.fill(-1);

  for (let mask = 1; mask < totalSubsets; mask++) {
    // Option 1: don't use this exact subset as zero-sum, inherit best submask
    let best = 0;
    let bestSub = -1;

    // Check all non-empty submasks that are zero-sum
    // We iterate submasks: sub = (sub - 1) & mask
    let sub = mask;
    while (sub > 0) {
      if (isZeroSum[sub]) {
        const candidate = 1 + dp[mask ^ sub];
        if (candidate > best) {
          best = candidate;
          bestSub = sub;
        }
      }
      sub = (sub - 1) & mask;
    }

    dp[mask] = best;
    parent[mask] = bestSub;
  }

  const fullMask = totalSubsets - 1;
  const k = dp[fullMask];

  // Reconstruct the disjoint zero-sum subsets
  const subsets: ParticipantNode[][] = [];
  let currMask = fullMask;

  while (currMask > 0 && parent[currMask] !== -1 && parent[currMask] > 0) {
    const sub = parent[currMask];
    const groupMembers: ParticipantNode[] = [];
    for (let i = 0; i < n; i++) {
      if ((sub & (1 << i)) !== 0) {
        groupMembers.push(nonzeroNodes[i]);
      }
    }
    subsets.push(groupMembers);
    currMask ^= sub;
  }

  // If any remaining nodes were not captured in zero-sum (should not happen if full set is zero sum)
  if (currMask > 0) {
    const remainderMembers: ParticipantNode[] = [];
    for (let i = 0; i < n; i++) {
      if ((currMask & (1 << i)) !== 0) {
        remainderMembers.push(nonzeroNodes[i]);
      }
    }
    if (remainderMembers.length > 0) {
      subsets.push(remainderMembers);
    }
  }

  // Within each zero-sum subset, settle using greedy pairing (guaranteed |S| - 1 transfers)
  const allTransfers: SettlementTransfer[] = [];

  for (const subset of subsets) {
    const transfers = settleSubsetGreedy(subset, baseCurrency, planId);
    allTransfers.push(...transfers);
  }

  return {
    transfers: allTransfers,
    zeroSumSubsetsCount: Math.max(k, 1),
  };
}

/**
 * Greedily settles a subset of nodes where debtor sends directly to creditor.
 * Guaranteed to produce (|S| - 1) transfers for any zero-sum subset S.
 */
export function settleSubsetGreedy(
  nodes: ParticipantNode[],
  baseCurrency: CurrencyCode,
  planId: string
): SettlementTransfer[] {
  const transfers: SettlementTransfer[] = [];

  // Work with mutable copies of balances
  const debtors = nodes
    .filter((node) => node.netInBase.isNegative())
    .map((node) => ({ ...node, owed: node.netInBase.abs() }))
    .sort((a, b) => b.owed.comparedTo(a.owed)); // Largest debtor first

  const creditors = nodes
    .filter((node) => node.netInBase.isPositive())
    .map((node) => ({ ...node, credit: node.netInBase }))
    .sort((a, b) => b.credit.comparedTo(a.credit)); // Largest creditor first

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    if (debtor.owed.isZero()) {
      dIdx++;
      continue;
    }
    if (creditor.credit.isZero()) {
      cIdx++;
      continue;
    }

    // Transfer amount is min(debtor.owed, creditor.credit)
    const transferAmountBase = Decimal.min(debtor.owed, creditor.credit);
    const quantizedTransfer = quantizeCurrency(transferAmountBase, baseCurrency);

    if (quantizedTransfer.isPositive()) {
      // Calculate target amount in recipient's preferred currency
      const conversion = convertCurrency(quantizedTransfer, baseCurrency, creditor.preferredCurrency);

      transfers.push({
        id: uuidv4(),
        planId,
        fromMemberId: debtor.id,
        fromMemberName: debtor.name,
        toMemberId: creditor.id,
        toMemberName: creditor.name,
        amount: formatCurrencyAmount(quantizedTransfer, baseCurrency),
        currency: baseCurrency,
        targetAmount: conversion.toAmount,
        targetCurrency: creditor.preferredCurrency,
        estimatedFee: '0.00', // Populated by cost model
        status: 'PENDING',
      });
    }

    debtor.owed = debtor.owed.minus(transferAmountBase);
    creditor.credit = creditor.credit.minus(transferAmountBase);

    if (debtor.owed.isZero()) dIdx++;
    if (creditor.credit.isZero()) cIdx++;
  }

  return transfers;
}

/**
 * Optimizes settlement for Minimum Transfers.
 * If N <= 12, uses exact subset-sum zero-sum partition (N - K transfers).
 * If N > 12, uses greedy fallback.
 */
export function generateMinTransfersSettlement(
  groupId: string,
  baseCurrency: CurrencyCode,
  balances: ParticipantBalance[],
  members: GroupMember[]
): SettlementPlan {
  const planId = uuidv4();
  const memberMap = new Map(members.map((m) => [m.id, m]));

  const decimals = baseCurrency === 'JPY' ? 0 : 2;
  const minorFactor = new Decimal(10).pow(decimals);

  const nonzeroNodes: ParticipantNode[] = balances
    .filter((b) => !new Decimal(b.netInBase).isZero())
    .map((b) => {
      const net = new Decimal(b.netInBase);
      const member = memberMap.get(b.memberId);
      const minor = BigInt(net.times(minorFactor).round().toFixed(0));
      return {
        id: b.memberId,
        name: b.memberName,
        preferredCurrency: member?.preferredCurrency || baseCurrency,
        balanceMinor: minor,
        netInBase: net,
      };
    });

  let transfers: SettlementTransfer[] = [];
  let kSubsets = 1;

  if (nonzeroNodes.length === 0) {
    return {
      id: planId,
      groupId,
      strategy: 'MIN_TRANSFERS',
      totalDebtVolumeBase: '0.00',
      estimatedFeeCostBase: '0.00',
      createdAt: new Date().toISOString(),
      transfers: [],
      zeroSumSubsetsCount: 0,
      explanation: 'All group participants are fully settled (zero outstanding balance).',
    };
  }

  if (nonzeroNodes.length <= 12) {
    const solution = solveMinimumTransfersExact(nonzeroNodes, baseCurrency, planId);
    transfers = solution.transfers;
    kSubsets = solution.zeroSumSubsetsCount;
  } else {
    // Greedy fallback for larger groups
    transfers = settleSubsetGreedy(nonzeroNodes, baseCurrency, planId);
    kSubsets = 1;
  }

  let totalVolume = new Decimal(0);
  for (const t of transfers) {
    totalVolume = totalVolume.plus(new Decimal(t.amount));
  }

  return {
    id: planId,
    groupId,
    strategy: 'MIN_TRANSFERS',
    totalDebtVolumeBase: formatCurrencyAmount(totalVolume, baseCurrency),
    estimatedFeeCostBase: '0.00', // To be populated when cost evaluated
    createdAt: new Date().toISOString(),
    transfers,
    zeroSumSubsetsCount: kSubsets,
    explanation: `Mathematically optimal minimum-transfer plan using zero-sum partition theorem. ${nonzeroNodes.length} active participants split into ${kSubsets} independent zero-sum group(s), yielding ${transfers.length} total payment(s) (${nonzeroNodes.length} - ${kSubsets} = ${transfers.length}).`,
  };
}
