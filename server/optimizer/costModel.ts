import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { CurrencyCode, GroupMember, ParticipantBalance, SettlementPlan, SettlementTransfer } from '../types';
import { formatCurrencyAmount, quantizeCurrency, toDecimal } from '../financial/currency';
import { convertCurrency } from '../financial/rates';
import { FEE_CONFIG, getFixedFeeForCurrency, getFxSpreadForPair } from '../config/fees';

/**
 * Empirical transparent cost models for peer/merchant cross-border corridors.
 * Clearly specifies which components are known vs estimated/unobservable.
 */
export interface CorridorsFeeModel {
  currencyPair: string;
  isDomestic: boolean;
  fixedFeeBase: string; // Known provider fixed capture fee from FEE_CONFIG
  estimatedFxSpreadPct: string; // e.g. 2.50% PayPal cross-border spread
  internationalSurchargePct: string; // e.g. 1.50% cross-border cross-region fee
  unobservableBankFeeEstimate: string; // External card/bank surcharge that provider cannot observe
  feeTransparencyNote: string;
}

export function getCorridorFeeModel(
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  baseCurrency: CurrencyCode
): CorridorsFeeModel {
  const isDomestic = fromCurrency === toCurrency;
  // Convert fixed fee from target currency to group base currency
  const targetFixedFee = getFixedFeeForCurrency(toCurrency);
  const fixedConv = convertCurrency(targetFixedFee, toCurrency, baseCurrency);
  const fixedFeeInBase = fixedConv.toAmount;

  if (isDomestic) {
    return {
      currencyPair: `${fromCurrency} -> ${toCurrency}`,
      isDomestic: true,
      fixedFeeBase: fixedFeeInBase,
      estimatedFxSpreadPct: '0.00',
      internationalSurchargePct: '0.00',
      unobservableBankFeeEstimate: '0.00',
      feeTransparencyNote: `Same currency settlement: Zero FX spread. Standard processing fee (${fixedFeeInBase} ${baseCurrency}) applies. (Source: ${FEE_CONFIG.sourceUrl})`,
    };
  }

  const { spreadPct, isMeasured } = getFxSpreadForPair(fromCurrency, toCurrency);

  return {
    currencyPair: `${fromCurrency} -> ${toCurrency}`,
    isDomestic: false,
    fixedFeeBase: fixedFeeInBase,
    estimatedFxSpreadPct: spreadPct,
    internationalSurchargePct: FEE_CONFIG.internationalCrossBorderSurchargePct,
    unobservableBankFeeEstimate: '0.00 (Unobservable: Issuer conversion charges depend on user bank card)',
    feeTransparencyNote:
      `Cross-border payment: ${spreadPct}% ${isMeasured ? 'measured sandbox' : 'estimated retail'} FX spread + ${FEE_CONFIG.internationalCrossBorderSurchargePct}% international surcharge + ${fixedFeeInBase} ${baseCurrency} fixed fee. Card issuer fees (typically 1-3%) cannot be observed directly. (Source: ${FEE_CONFIG.sourceUrl})`,
  };
}

/**
 * Calculates estimated total fee cost for a given transfer in base currency.
 */
export function estimateTransferFee(
  transferAmountBase: Decimal,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  baseCurrency: CurrencyCode
): { estimatedTotalFeeBase: Decimal; feeModel: CorridorsFeeModel } {
  const model = getCorridorFeeModel(fromCurrency, toCurrency, baseCurrency);

  const fixedFee = new Decimal(model.fixedFeeBase);
  const spreadRate = new Decimal(model.estimatedFxSpreadPct).dividedBy(100);
  const surchargeRate = new Decimal(model.internationalSurchargePct).dividedBy(100);

  const spreadCost = transferAmountBase.times(spreadRate);
  const surchargeCost = transferAmountBase.times(surchargeRate);

  const totalFee = fixedFee.plus(spreadCost).plus(surchargeCost);
  const quantized = quantizeCurrency(totalFee, baseCurrency);

  return {
    estimatedTotalFeeBase: quantized,
    feeModel: model,
  };
}

/**
 * Generates the Minimum Estimated Settlement Cost strategy.
 * Instead of strictly minimizing transfer count, this strategy prioritizes:
 * 1. Matching participants who share the same preferred currency first (0% FX spread).
 * 2. Routing remaining debts through lowest-cost domestic or single-conversion corridors.
 * 3. Minimizing high-spread cross-currency volume.
 */
export function generateMinCostSettlement(
  groupId: string,
  baseCurrency: CurrencyCode,
  balances: ParticipantBalance[],
  members: GroupMember[]
): SettlementPlan {
  const planId = uuidv4();
  const memberMap = new Map(members.map((m) => [m.id, m]));

  const nonzeroNodes = balances
    .filter((b) => !new Decimal(b.netInBase).isZero())
    .map((b) => {
      const net = new Decimal(b.netInBase);
      const member = memberMap.get(b.memberId);
      return {
        id: b.memberId,
        name: b.memberName,
        preferredCurrency: member?.preferredCurrency || baseCurrency,
        netInBase: net,
        owed: net.isNegative() ? net.abs() : new Decimal(0),
        credit: net.isPositive() ? net : new Decimal(0),
      };
    });

  if (nonzeroNodes.length === 0) {
    return {
      id: planId,
      groupId,
      strategy: 'MIN_COST',
      totalDebtVolumeBase: '0.00',
      estimatedFeeCostBase: '0.00',
      createdAt: new Date().toISOString(),
      transfers: [],
      explanation: 'All participants are fully settled.',
    };
  }

  const transfers: SettlementTransfer[] = [];

  // PHASE 1: Settle same-currency debtors and creditors first (Zero FX Spread)
  const currencyGroups = new Set(nonzeroNodes.map((n) => n.preferredCurrency));

  for (const curr of currencyGroups) {
    const sameCurrDebtors = nonzeroNodes.filter((n) => n.preferredCurrency === curr && n.owed.isPositive());
    const sameCurrCreditors = nonzeroNodes.filter((n) => n.preferredCurrency === curr && n.credit.isPositive());

    for (const d of sameCurrDebtors) {
      for (const c of sameCurrCreditors) {
        if (d.owed.isZero()) break;
        if (c.credit.isZero()) continue;

        const settleAmount = Decimal.min(d.owed, c.credit);
        if (settleAmount.isPositive()) {
          const quantized = quantizeCurrency(settleAmount, baseCurrency);
          const targetConv = convertCurrency(quantized, baseCurrency, c.preferredCurrency);

          const { estimatedTotalFeeBase } = estimateTransferFee(
            quantized,
            d.preferredCurrency,
            c.preferredCurrency,
            baseCurrency
          );

          transfers.push({
            id: uuidv4(),
            planId,
            fromMemberId: d.id,
            fromMemberName: d.name,
            toMemberId: c.id,
            toMemberName: c.name,
            amount: quantized.toString(),
            currency: baseCurrency,
            targetAmount: targetConv.toAmount,
            targetCurrency: c.preferredCurrency,
            estimatedFee: estimatedTotalFeeBase.toString(),
            status: 'PENDING',
          });

          d.owed = d.owed.minus(settleAmount);
          c.credit = c.credit.minus(settleAmount);
        }
      }
    }
  }

  // PHASE 2: Settle cross-currency remaining balances
  const remainingDebtors = nonzeroNodes.filter((n) => n.owed.isPositive()).sort((a, b) => b.owed.comparedTo(a.owed));
  const remainingCreditors = nonzeroNodes
    .filter((n) => n.credit.isPositive())
    .sort((a, b) => b.credit.comparedTo(a.credit));

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < remainingDebtors.length && cIdx < remainingCreditors.length) {
    const d = remainingDebtors[dIdx];
    const c = remainingCreditors[cIdx];

    if (d.owed.isZero()) {
      dIdx++;
      continue;
    }
    if (c.credit.isZero()) {
      cIdx++;
      continue;
    }

    const settleAmount = Decimal.min(d.owed, c.credit);
    if (settleAmount.isPositive()) {
      const quantized = quantizeCurrency(settleAmount, baseCurrency);
      const targetConv = convertCurrency(quantized, baseCurrency, c.preferredCurrency);

      const { estimatedTotalFeeBase } = estimateTransferFee(
        quantized,
        d.preferredCurrency,
        c.preferredCurrency,
        baseCurrency
      );

      transfers.push({
        id: uuidv4(),
        planId,
        fromMemberId: d.id,
        fromMemberName: d.name,
        toMemberId: c.id,
        toMemberName: c.name,
        amount: quantized.toString(),
        currency: baseCurrency,
        targetAmount: targetConv.toAmount,
        targetCurrency: c.preferredCurrency,
        estimatedFee: estimatedTotalFeeBase.toString(),
        status: 'PENDING',
      });

      d.owed = d.owed.minus(settleAmount);
      c.credit = c.credit.minus(settleAmount);
    }

    if (d.owed.isZero()) dIdx++;
    if (c.credit.isZero()) cIdx++;
  }

  // Compute total volume & total estimated fees
  let totalVolume = new Decimal(0);
  let totalEstimatedFee = new Decimal(0);

  for (const t of transfers) {
    totalVolume = totalVolume.plus(new Decimal(t.amount));
    totalEstimatedFee = totalEstimatedFee.plus(new Decimal(t.estimatedFee));
  }

  return {
    id: planId,
    groupId,
    strategy: 'MIN_COST',
    totalDebtVolumeBase: formatCurrencyAmount(totalVolume, baseCurrency),
    estimatedFeeCostBase: formatCurrencyAmount(totalEstimatedFee, baseCurrency),
    createdAt: new Date().toISOString(),
    transfers,
    explanation:
      'Fee-optimized settlement: Prioritizes same-currency pairings first to avoid international FX retail spread (2.5%), then minimizes cross-border conversion volume. May require slightly more transactions to save on aggregate FX spreads.',
  };
}

/**
 * Enhances a minimum-transfers plan by attaching estimated fee calculations to each transfer.
 */
export function enrichPlanWithFees(
  plan: SettlementPlan,
  baseCurrency: CurrencyCode,
  members: GroupMember[]
): SettlementPlan {
  const memberMap = new Map(members.map((m) => [m.id, m]));
  let totalEstimatedFees = new Decimal(0);

  const enrichedTransfers = plan.transfers.map((t) => {
    const fromMember = memberMap.get(t.fromMemberId);
    const toMember = memberMap.get(t.toMemberId);

    const fromCurr = fromMember?.preferredCurrency || baseCurrency;
    const toCurr = toMember?.preferredCurrency || baseCurrency;

    const { estimatedTotalFeeBase } = estimateTransferFee(new Decimal(t.amount), fromCurr, toCurr, baseCurrency);

    totalEstimatedFees = totalEstimatedFees.plus(estimatedTotalFeeBase);

    return {
      ...t,
      estimatedFee: estimatedTotalFeeBase.toString(),
    };
  });

  return {
    ...plan,
    transfers: enrichedTransfers,
    estimatedFeeCostBase: quantizeCurrency(totalEstimatedFees, baseCurrency).toString(),
  };
}
