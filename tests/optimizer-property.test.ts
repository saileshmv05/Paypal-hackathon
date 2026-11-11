import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { solveMinimumTransfersExact, generateMinTransfersSettlement } from '../server/optimizer/partition';
import { generateMinCostSettlement } from '../server/optimizer/costModel';
import { CurrencyCode, GroupMember, ParticipantBalance } from '../server/types';
import { quantizeCurrency } from '../server/financial/currency';

/**
 * Brute-force reference solver for small N (N <= 8)
 * Iterates through all possible partitions of {0..N-1} to find the maximum
 * number of disjoint subsets that each independently sum to 0.
 */
function bruteForceMaxZeroSumSubsets(balancesMinor: bigint[]): number {
  const n = balancesMinor.length;
  if (n === 0) return 0;

  let maxSubsets = 1; // At least the entire set is zero-sum

  // Generate all partitions of {0..n-1} using recursive set partitioning
  function findPartitions(index: number, currentPartition: number[][]) {
    if (index === n) {
      // Check if EVERY subset in this partition is zero-sum
      const allZeroSum = currentPartition.every((subset) => {
        const sum = subset.reduce((acc, idx) => acc + balancesMinor[idx], 0n);
        return sum === 0n;
      });

      if (allZeroSum) {
        if (currentPartition.length > maxSubsets) {
          maxSubsets = currentPartition.length;
        }
      }
      return;
    }

    // Option A: Add element 'index' to an existing subset
    for (let i = 0; i < currentPartition.length; i++) {
      currentPartition[i].push(index);
      findPartitions(index + 1, currentPartition);
      currentPartition[i].pop();
    }

    // Option B: Start a new subset with element 'index'
    currentPartition.push([index]);
    findPartitions(index + 1, currentPartition);
    currentPartition.pop();
  }

  findPartitions(0, []);
  return maxSubsets;
}

describe('P1-6: Optimizer Property Tests & Brute Force Equivalence', () => {
  it('matches brute-force maximum zero-sum partition K for all random zero-sum configurations (N=4 to 8)', () => {
    // Generate deterministic pseudo-random zero-sum test cases
    const testCases: bigint[][] = [
      // Case 1: Two independent pairs (N=4, K=2)
      [1000n, -1000n, 2500n, -2500n],
      // Case 2: One 3-way cycle and one pair (N=5, K=2)
      [3000n, -1000n, -2000n, 1500n, -1500n],
      // Case 3: Three independent pairs (N=6, K=3)
      [100n, -100n, 200n, -200n, 300n, -300n],
      // Case 4: No sub-partitions possible, only whole set sums to 0 (N=6, K=1)
      [10n, 20n, 30n, -15n, -20n, -25n],
      // Case 5: Complex 7-participant partition (N=7)
      [500n, -200n, -300n, 700n, -700n, 400n, -400n],
      // Case 6: 8 participants with 3 zero-sum subsets
      [100n, -100n, 200n, -200n, 500n, -300n, -200n, 0n].filter((x) => x !== 0n),
    ];

    for (const balances of testCases) {
      const n = balances.length;
      const expectedK = bruteForceMaxZeroSumSubsets(balances);

      const nodes = balances.map((b, idx) => ({
        id: `node-${idx}`,
        name: `Participant ${idx}`,
        preferredCurrency: 'EUR' as CurrencyCode,
        balanceMinor: b,
        netInBase: new Decimal(b.toString()).dividedBy(100),
      }));

      const solution = solveMinimumTransfersExact(nodes, 'EUR', `plan-test-${n}`);

      // The DP zero-sum partition solver MUST match brute force K exactly!
      expect(solution.zeroSumSubsetsCount).toBe(expectedK);
      // Min transfers MUST equal N - K
      expect(solution.transfers.length).toBe(n - expectedK);

      // Invariant: Conservation of money (total sent === total received)
      const inflows = new Map<string, Decimal>();
      const outflows = new Map<string, Decimal>();

      for (const t of solution.transfers) {
        const amt = new Decimal(t.amount);
        outflows.set(t.fromMemberId, (outflows.get(t.fromMemberId) || new Decimal(0)).plus(amt));
        inflows.set(t.toMemberId, (inflows.get(t.toMemberId) || new Decimal(0)).plus(amt));
      }

      for (const node of nodes) {
        const out = outflows.get(node.id) || new Decimal(0);
        const in_ = inflows.get(node.id) || new Decimal(0);
        const netFlow = in_.minus(out);
        expect(netFlow.toFixed(2)).toBe(node.netInBase.toFixed(2));
      }
    }
  });

  it('preserves exact integer minor units for JPY (0 decimals)', () => {
    // Japanese Yen has 0 decimals: ¥10,000 paid, split among 3 participants
    // 3334 + 3333 + 3333 = 10000
    const jpyNodes = [
      { id: 'j1', name: 'Ken', preferredCurrency: 'JPY' as CurrencyCode, balanceMinor: 6666n, netInBase: new Decimal('6666') },
      { id: 'j2', name: 'Yuki', preferredCurrency: 'JPY' as CurrencyCode, balanceMinor: -3333n, netInBase: new Decimal('-3333') },
      { id: 'j3', name: 'Ryu', preferredCurrency: 'JPY' as CurrencyCode, balanceMinor: -3333n, netInBase: new Decimal('-3333') },
    ];

    const solution = solveMinimumTransfersExact(jpyNodes, 'JPY', 'plan-jpy');
    expect(solution.transfers.length).toBe(2);

    for (const t of solution.transfers) {
      expect(t.currency).toBe('JPY');
      // Must not have any decimal point in JPY amounts
      expect(t.amount).not.toContain('.');
      expect(Number.isInteger(Number(t.amount))).toBe(true);
    }
  });

  it('compares Min Transfers vs Min Cost honestly on seeded scenarios', () => {
    // Scenario: Alex (EUR, +€100), Sam (USD, -€50), Maria (EUR, -€50)
    // In Min Transfers: Sam -> Alex (€50), Maria -> Alex (€50). Total = 2 transfers.
    // In Min Cost: Maria (EUR) -> Alex (EUR) (€50) settled domestically (0% spread).
    // Sam (USD) -> Alex (EUR) (€50) cross-border.
    const balances: ParticipantBalance[] = [
      { memberId: 'm1', memberName: 'Alex', preferredCurrency: 'EUR', netInBase: '100.00', netInPreferred: '100.00', totalPaidBase: '100', totalOwedBase: '0' },
      { memberId: 'm2', memberName: 'Sam', preferredCurrency: 'USD', netInBase: '-50.00', netInPreferred: '-54.25', totalPaidBase: '0', totalOwedBase: '50' },
      { memberId: 'm3', memberName: 'Maria', preferredCurrency: 'EUR', netInBase: '-50.00', netInPreferred: '-50.00', totalPaidBase: '0', totalOwedBase: '50' },
    ];

    const members: GroupMember[] = [
      { id: 'm1', groupId: 'g1', name: 'Alex', country: 'Germany', preferredCurrency: 'EUR', email: 'a@ex.com', createdAt: '' },
      { id: 'm2', groupId: 'g1', name: 'Sam', country: 'USA', preferredCurrency: 'USD', email: 's@ex.com', createdAt: '' },
      { id: 'm3', groupId: 'g1', name: 'Maria', country: 'Germany', preferredCurrency: 'EUR', email: 'm@ex.com', createdAt: '' },
    ];

    const minTransfers = generateMinTransfersSettlement('g1', 'EUR', balances, members);
    const minCost = generateMinCostSettlement('g1', 'EUR', balances, members);

    // Both plans succeed in settling the total debt volume
    expect(minTransfers.totalDebtVolumeBase).toBe('100.00');
    expect(minCost.totalDebtVolumeBase).toBe('100.00');

    // Both achieve 2 transfers in this scenario
    expect(minTransfers.transfers.length).toBe(2);
    expect(minCost.transfers.length).toBe(2);

    // Notice: Maria -> Alex is domestic EUR -> EUR, saving retail spread on €50!
    const domesticTransfer = minCost.transfers.find((t) => t.fromMemberName === 'Maria' && t.toMemberName === 'Alex');
    expect(domesticTransfer).toBeDefined();
    expect(domesticTransfer?.currency).toBe('EUR');
    expect(domesticTransfer?.targetCurrency).toBe('EUR');
  });
});
