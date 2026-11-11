import Decimal from 'decimal.js';
import { CurrencyCode, Expense, GroupMember, ParticipantBalance, SettlementTransfer } from '../types';
import { formatCurrencyAmount, quantizeCurrency, toDecimal } from './currency';
import { convertCurrency } from './rates';

export interface BalanceCalculationInput {
  baseCurrency: CurrencyCode;
  members: GroupMember[];
  expenses: Expense[];
  transfers?: SettlementTransfer[];
}

export interface GroupBalanceSummary {
  baseCurrency: CurrencyCode;
  totalExpensesBase: string;
  balances: ParticipantBalance[];
  isBalanced: boolean;
  discrepancyBase: string;
}

/**
 * Calculates net balances for all group members with exact decimal arithmetic.
 * Ensures the zero-sum invariant: sum of net balances === 0.
 */
export function calculateGroupBalances(input: BalanceCalculationInput): GroupBalanceSummary {
  const { baseCurrency, members, expenses, transfers = [] } = input;

  const totalPaidMap = new Map<string, Decimal>();
  const totalOwedMap = new Map<string, Decimal>();

  for (const m of members) {
    totalPaidMap.set(m.id, new Decimal(0));
    totalOwedMap.set(m.id, new Decimal(0));
  }

  let totalExpensesBase = new Decimal(0);

  // 1. Process Approved Expenses
  for (const exp of expenses) {
    if (exp.status !== 'APPROVED') continue;

    const baseAmount = toDecimal(exp.baseAmount);
    totalExpensesBase = totalExpensesBase.plus(baseAmount);

    // Credit the payer
    const currentPaid = totalPaidMap.get(exp.payerId) || new Decimal(0);
    totalPaidMap.set(exp.payerId, currentPaid.plus(baseAmount));

    // Debit each split participant
    if (exp.splits && exp.splits.length > 0) {
      for (const split of exp.splits) {
        const shareBase = toDecimal(split.shareBaseAmount);
        const currentOwed = totalOwedMap.get(split.memberId) || new Decimal(0);
        totalOwedMap.set(split.memberId, currentOwed.plus(shareBase));
      }
    }
  }

  // 2. Process Completed / Settled Transfers
  for (const t of transfers) {
    if (t.status === 'COMPLETED' || t.status === 'SETTLED_EXTERNALLY') {
      // Convert transfer amount to group base currency if not already
      const converted = convertCurrency(t.amount, t.currency, baseCurrency);
      const transferBase = toDecimal(converted.toAmount);

      // Sender has paid down their debt -> balance increases (more positive / less negative)
      const currentPaid = totalPaidMap.get(t.fromMemberId) || new Decimal(0);
      totalPaidMap.set(t.fromMemberId, currentPaid.plus(transferBase));

      // Receiver has received payment -> balance decreases (less positive / more neutral)
      const currentOwed = totalOwedMap.get(t.toMemberId) || new Decimal(0);
      totalOwedMap.set(t.toMemberId, currentOwed.plus(transferBase));
    }
  }

  // 3. Build Participant Balances
  const balances: ParticipantBalance[] = [];
  let sumNetBase = new Decimal(0);

  for (const m of members) {
    const paid = totalPaidMap.get(m.id) || new Decimal(0);
    const owed = totalOwedMap.get(m.id) || new Decimal(0);
    const netBase = quantizeCurrency(paid.minus(owed), baseCurrency);

    sumNetBase = sumNetBase.plus(netBase);

    // Also convert net balance to member's preferred currency
    const prefConversion = convertCurrency(netBase, baseCurrency, m.preferredCurrency);

    balances.push({
      memberId: m.id,
      memberName: m.name,
      preferredCurrency: m.preferredCurrency,
      netInBase: formatCurrencyAmount(netBase, baseCurrency),
      netInPreferred: prefConversion.toAmount,
      totalPaidBase: formatCurrencyAmount(paid, baseCurrency),
      totalOwedBase: formatCurrencyAmount(owed, baseCurrency),
    });
  }

  // Zero-sum financial check
  const quantizedSum = quantizeCurrency(sumNetBase, baseCurrency);
  const isBalanced = quantizedSum.isZero();

  return {
    baseCurrency,
    totalExpensesBase: formatCurrencyAmount(totalExpensesBase, baseCurrency),
    balances,
    isBalanced,
    discrepancyBase: formatCurrencyAmount(quantizedSum, baseCurrency),
  };
}
