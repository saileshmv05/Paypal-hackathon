import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import {
  CurrencyCode,
  ProviderType,
  ReconciliationRecord,
  ReconciliationStatus,
  SettlementTransfer,
} from '../types';
import { formatCurrencyAmount, quantizeCurrency, toDecimal } from '../financial/currency';
import { convertCurrency, DEFAULT_REFERENCE_RATES_EUR_BASE, REFERENCE_RATE_METADATA } from '../financial/rates';
import { NormalizedCaptureResponse, ProviderQuoteResponse } from '../paypal/types';

export interface BuildReconciliationParams {
  transfer: SettlementTransfer;
  provider: ProviderType;
  quote?: ProviderQuoteResponse | null;
  capture?: NormalizedCaptureResponse | null;
  baseCurrency: CurrencyCode;
}

/**
 * Deterministic Payment Reconciliation Engine.
 * Reconciles the 4 financial facets:
 * 1. Ledger Value
 * 2. Provider Quotation
 * 3. Actual Provider Result
 * 4. Discrepancy & Fee Analysis
 */
export function buildReconciliationRecord(params: BuildReconciliationParams): ReconciliationRecord {
  const { transfer, provider, quote, capture, baseCurrency } = params;
  const id = uuidv4();

  // 1. Group Ledger Value
  const ledgerOriginalAmount = transfer.amount;
  const ledgerOriginalCurrency = transfer.currency;
  const ledgerBaseCurrency = baseCurrency;

  const refConversion = convertCurrency(transfer.amount, transfer.currency, baseCurrency);
  const ledgerReferenceRate = refConversion.effectiveRate;
  const ledgerRateSource = refConversion.rateSource;
  const ledgerRateTimestamp = refConversion.rateTimestamp;
  const ledgerConvertedBaseAmount = refConversion.toAmount;

  // 2. Provider Quotation
  const quoteStatus = quote?.status || 'UNAVAILABLE';
  const quoteAmount = quote?.quotedAmount || null;
  const quoteCurrency = quote?.quotedCurrency || null;
  const quoteFxRate = quote?.providerFxRate || null;
  const quoteId = quote?.quoteId || null;
  const quoteExpiresAt = quote?.expiresAt || null;

  // 3. Actual Provider Result
  const captureId = capture?.providerCaptureId || null;
  const captureGrossAmount = capture?.grossAmount || null;
  const captureGrossCurrency = capture?.grossCurrency || null;
  const captureFeeAmount = capture?.feeAmount || null;
  const captureFeeCurrency = capture?.feeCurrency || null;
  const captureNetAmount = capture?.netAmount || null;
  const captureNetCurrency = capture?.netCurrency || null;
  const captureEffectiveRate = capture?.effectiveFxRate || null;
  const captureReceivableAmount = capture?.receivableAmount || null;
  const captureReceivableCurrency = capture?.receivableCurrency || null;
  const captureTimestamp = capture?.capturedAt || null;

  // 4. Reconciliation Math & Status Determination
  let status: ReconciliationStatus = 'CAPTURE_PENDING';
  let matchStatus: import('../types').ReconciliationMatchStatus = 'PENDING';
  let diffLedgerVsCaptureGross: string | null = null;
  let diffQuoteVsCaptureGross: string | null = null;
  let observedProviderFee: string | null = null;
  let unobservableChargesEstimate: string | null = null;
  const explanations: string[] = [];

  if (!capture) {
    status = quote && quote.status === 'QUOTE_AVAILABLE' ? 'QUOTE_AVAILABLE' : 'QUOTE_PENDING';
    matchStatus = 'PENDING';
    explanations.push('Awaiting provider capture execution.');
  } else if (capture.status === 'FAILED') {
    status = 'CAPTURE_FAILED';
    matchStatus = 'FAILED';
    explanations.push('Provider transaction capture failed or was rejected by the processor.');
  } else if (capture.status === 'COMPLETED') {
    status = 'RECONCILIATION_COMPLETE';

    // Fee observed directly from capture
    const feeDec = toDecimal(capture.feeAmount);
    observedProviderFee = formatCurrencyAmount(feeDec, capture.feeCurrency);

    // Economic comparison 1: Ledger expected gross vs captured gross
    // Only compare directly if currency is identical, otherwise convert via reference rate
    if (capture.grossCurrency === transfer.currency) {
      const grossDec = toDecimal(capture.grossAmount);
      const ledgerDec = toDecimal(transfer.amount);
      const diff = grossDec.minus(ledgerDec);
      diffLedgerVsCaptureGross = formatCurrencyAmount(diff, transfer.currency);

      if (diff.isZero()) {
        matchStatus = 'MATCHED';
        explanations.push(`Gross capture matches expected obligation exactly (${transfer.amount} ${transfer.currency}).`);
      } else if (diff.isPositive()) {
        matchStatus = 'OVERPAID';
        explanations.push(`Overpayment detected: Captured gross exceeds obligation by ${diffLedgerVsCaptureGross} ${transfer.currency}.`);
      } else {
        matchStatus = 'UNDERPAID';
        explanations.push(`Underpayment detected: Captured gross is short by ${diff.abs().toFixed(2)} ${transfer.currency}.`);
      }
    } else {
      matchStatus = 'REQUIRES_REVIEW';
      explanations.push(
        `Cross-currency capture: Obligation in ${transfer.currency}, Provider captured in ${capture.grossCurrency}. Direct subtraction requires FX conversion.`
      );
    }

    // Comparison 2: Quote vs Captured Gross (if quote was provided)
    if (quote && quote.quotedAmount && quote.quotedCurrency === capture.grossCurrency) {
      const qDec = toDecimal(quote.quotedAmount);
      const capDec = toDecimal(capture.grossAmount);
      const qDiff = capDec.minus(qDec);
      diffQuoteVsCaptureGross = quantizeCurrency(qDiff, capture.grossCurrency).toString();
      if (!qDiff.isZero()) {
        explanations.push(`Capture amount deviated from initial quote by ${diffQuoteVsCaptureGross} ${capture.grossCurrency}.`);
      }
    } else {
      diffQuoteVsCaptureGross = null;
      explanations.push('Pre-capture provider quote was unavailable (PayPal Orders v2 standard checkout behavior).');
    }

    // Transparency Note regarding sender fees & recipient credit
    explanations.push(
      `Provider captured gross ${capture.grossAmount} ${capture.grossCurrency}. Provider processing fee deducted: ${capture.feeAmount} ${capture.feeCurrency}. Net proceeds credited to payee: ${capture.netAmount} ${capture.netCurrency}.`
    );

    // Unobservable fees disclosure
    unobservableChargesEstimate = '0.00 (Unobservable: Issuer foreign transaction fees)';
    explanations.push(
      'Notice: Sender-side card issuer foreign exchange fees (typically 1.0% - 3.0% assessed by credit card banks) cannot be observed via PayPal API.'
    );
  }

  const decisionTrace = {
    expectedAmount: `${transfer.amount} ${transfer.currency}`,
    capturedGross: capture ? `${capture.grossAmount} ${capture.grossCurrency}` : 'N/A',
    providerFee: capture ? `${capture.feeAmount} ${capture.feeCurrency}` : 'N/A',
    netReceived: capture ? `${capture.netAmount} ${capture.netCurrency}` : 'N/A',
    variance: diffLedgerVsCaptureGross ? `${diffLedgerVsCaptureGross} ${transfer.currency}` : '0.00',
    summary: explanations.join(' '),
  };

  return {
    id,
    transferId: transfer.id,
    transactionId: captureId || `TX-${id.substring(0, 8)}`,
    provider,
    status,
    matchStatus,
    captureProvenance: provider === 'PAYPAL_SANDBOX' ? 'PAYPAL-CAPTURE' : provider === 'MANUAL' ? 'MANUAL' : 'SIMULATED',
    ledgerOriginalAmount,
    ledgerOriginalCurrency,
    ledgerReferenceRate,
    ledgerRateSource,
    ledgerRateTimestamp,
    ledgerConvertedBaseAmount,
    ledgerBaseCurrency,
    quoteAmount,
    quoteCurrency,
    quoteFxRate,
    quoteId,
    quoteExpiresAt,
    quoteStatus,
    captureId,
    captureGrossAmount,
    captureGrossCurrency,
    captureFeeAmount,
    captureFeeCurrency,
    captureNetAmount,
    captureNetCurrency,
    captureEffectiveRate,
    captureReceivableAmount,
    captureReceivableCurrency,
    captureTimestamp,
    diffLedgerVsCaptureGross,
    diffQuoteVsCaptureGross,
    observedProviderFee,
    unobservableChargesEstimate,
    explanation: explanations.join(' '),
    decisionTrace,
    createdAt: new Date().toISOString(),
  };
}
