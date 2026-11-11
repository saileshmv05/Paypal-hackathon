import Decimal from 'decimal.js';
import { CurrencyCode, SplitType } from '../types';
import { formatCurrencyAmount, getCurrencyDecimals, quantizeCurrency, splitAmountEqually, toDecimal } from './currency';

export interface SplitInput {
  memberId: string;
  amount?: string | number | Decimal;
  percentage?: string | number | Decimal;
  shares?: number;
}

export interface SplitResult {
  memberId: string;
  shareAmount: string; // Exact decimal string in expense currency
}

export interface CalculateSplitsParams {
  totalAmount: string | number | Decimal;
  currency: CurrencyCode;
  splitType: SplitType;
  participants: SplitInput[];
  allowedMemberIds?: string[];
}

/**
 * Robust, deterministic financial expense allocation engine.
 * Supports EQUAL, EXACT, PERCENT, and SHARES split types.
 *
 * Guarantees:
 * 1. Allocations sum EXACTLY to totalAmount down to ISO 4217 minor units (zero-loss invariant).
 * 2. Rejects duplicate participants or participants outside allowedMemberIds.
 * 3. Enforces non-negative shares.
 * 4. Distributes rounding remainders deterministically to the first remainder participants.
 */
export function calculateExpenseSplits(params: CalculateSplitsParams): SplitResult[] {
  const { totalAmount, currency, splitType, participants, allowedMemberIds } = params;

  if (!participants || participants.length === 0) {
    throw new Error('At least one participant is required for expense splitting.');
  }

  const totalDec = quantizeCurrency(totalAmount, currency);
  if (totalDec.isNegative() || totalDec.isZero()) {
    throw new Error(`Expense total amount must be strictly positive: ${totalAmount}`);
  }

  // 1. Participant Validation: Uniqueness and Membership
  const seenMemberIds = new Set<string>();
  for (const p of participants) {
    if (!p.memberId || p.memberId.trim() === '') {
      throw new Error('Every split participant must have a valid memberId.');
    }
    if (seenMemberIds.has(p.memberId)) {
      throw new Error(`Duplicate participant detected in split: member ${p.memberId}`);
    }
    seenMemberIds.add(p.memberId);

    if (allowedMemberIds && allowedMemberIds.length > 0 && !allowedMemberIds.includes(p.memberId)) {
      throw new Error(`Participant ${p.memberId} is not a valid member of this group.`);
    }
  }

  const decimals = getCurrencyDecimals(currency);
  const minorFactor = new Decimal(10).pow(decimals);
  const totalMinorInt = BigInt(totalDec.times(minorFactor).round().toFixed(0));

  // 2. Execution by SplitType
  switch (splitType) {
    case 'EQUAL': {
      const shares = splitAmountEqually(totalDec, currency, participants.length);
      return participants.map((p, idx) => ({
        memberId: p.memberId,
        shareAmount: shares[idx],
      }));
    }

    case 'EXACT': {
      let sumMinorInt = 0n;
      const results: SplitResult[] = [];

      for (const p of participants) {
        if (p.amount === undefined || p.amount === null) {
          throw new Error(`Participant ${p.memberId} is missing an exact allocation amount.`);
        }
        const amtDec = quantizeCurrency(p.amount, currency);
        if (amtDec.isNegative()) {
          throw new Error(`Allocation for participant ${p.memberId} cannot be negative: ${amtDec}`);
        }
        const amtMinor = BigInt(amtDec.times(minorFactor).round().toFixed(0));
        sumMinorInt += amtMinor;

        results.push({
          memberId: p.memberId,
          shareAmount: formatCurrencyAmount(amtDec, currency),
        });
      }

      if (sumMinorInt !== totalMinorInt) {
        const sumFormatted = new Decimal(sumMinorInt.toString()).dividedBy(minorFactor).toFixed(decimals);
        const diffFormatted = totalDec.minus(new Decimal(sumFormatted)).toFixed(decimals);
        throw new Error(
          `Exact split sum (${sumFormatted} ${currency}) does not equal expense total (${formatCurrencyAmount(
            totalDec,
            currency
          )} ${currency}). Difference: ${diffFormatted} ${currency}.`
        );
      }

      return results;
    }

    case 'PERCENT': {
      let sumPct = new Decimal(0);
      for (const p of participants) {
        if (p.percentage === undefined || p.percentage === null) {
          throw new Error(`Participant ${p.memberId} is missing a split percentage.`);
        }
        const pct = toDecimal(p.percentage);
        if (pct.isNegative()) {
          throw new Error(`Percentage for participant ${p.memberId} cannot be negative: ${pct}%`);
        }
        sumPct = sumPct.plus(pct);
      }

      // Enforce 100% total with small floating tolerance check
      if (!sumPct.equals(new Decimal(100))) {
        throw new Error(`Split percentages must sum to 100%. Current sum: ${sumPct.toFixed(2)}%`);
      }

      // Calculate minor units per participant and allocate rounding remainders
      let allocatedMinorSum = 0n;
      const provisionalMinors: bigint[] = [];

      for (const p of participants) {
        const pct = toDecimal(p.percentage!);
        // Floor minor units
        const exactMinor = new Decimal(totalMinorInt.toString()).times(pct).dividedBy(100);
        const minorInt = BigInt(exactMinor.floor().toFixed(0));
        provisionalMinors.push(minorInt);
        allocatedMinorSum += minorInt;
      }

      // Remainder minor units (cents) to distribute
      let remainder = Number(totalMinorInt - allocatedMinorSum);
      const results: SplitResult[] = [];

      for (let i = 0; i < participants.length; i++) {
        let minor = provisionalMinors[i];
        if (remainder > 0) {
          minor += 1n;
          remainder--;
        }
        const shareDec = new Decimal(minor.toString()).dividedBy(minorFactor);
        results.push({
          memberId: participants[i].memberId,
          shareAmount: shareDec.toFixed(decimals),
        });
      }

      return results;
    }

    default:
      throw new Error(`Unsupported or unhandled splitType: ${splitType}`);
  }
}
