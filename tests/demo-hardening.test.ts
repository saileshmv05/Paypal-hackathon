import { describe, it, expect } from 'vitest';
import { buildReconciliationRecord } from '../server/reconciliation/engine';
import { SettlementTransfer } from '../server/types';

describe('P1-7: Demo Hardening & Edge Cases', () => {
  const sampleTransfer: SettlementTransfer = {
    id: 't-harden-001',
    planId: 'p-1',
    fromMemberId: 'm-sam',
    fromMemberName: 'Sam',
    toMemberId: 'm-alex',
    toMemberName: 'Alex',
    amount: '100.00',
    currency: 'EUR',
    targetAmount: '100.00',
    targetCurrency: 'EUR',
    estimatedFee: '3.88',
    status: 'PENDING',
  };

  it('handles failed or denied provider captures with explicit non-success status', () => {
    const failedCapture = {
      providerCaptureId: 'CAP-FAILED-DENIED-99',
      status: 'FAILED' as const,
      grossAmount: '100.00',
      grossCurrency: 'EUR' as const,
      feeAmount: '0.00',
      feeCurrency: 'EUR' as const,
      netAmount: '0.00',
      netCurrency: 'EUR' as const,
      effectiveFxRate: null,
      receivableAmount: null,
      receivableCurrency: null,
      capturedAt: '2026-11-11T12:00:00Z',
      rawSanitizedPayload: { error: 'INSTRUMENT_DECLINED' },
      transparencyNotice: 'Capture rejected by processor.',
    };

    const record = buildReconciliationRecord({
      transfer: sampleTransfer,
      provider: 'PAYPAL_SANDBOX',
      quote: null,
      capture: failedCapture,
      baseCurrency: 'EUR',
    });

    expect(record.status).toBe('CAPTURE_FAILED');
    expect(record.captureId).toBe('CAP-FAILED-DENIED-99');
    expect(record.explanation).toContain('failed or was rejected');
    expect(record.diffLedgerVsCaptureGross).toBeNull();
  });

  it('protects idempotency: identical transfer capture does not corrupt ledger amounts', () => {
    const capture1 = {
      providerCaptureId: 'CAP-IDEMP-001',
      status: 'COMPLETED' as const,
      grossAmount: '100.00',
      grossCurrency: 'EUR' as const,
      feeAmount: '3.88',
      feeCurrency: 'EUR' as const,
      netAmount: '96.12',
      netCurrency: 'EUR' as const,
      effectiveFxRate: null,
      receivableAmount: null,
      receivableCurrency: null,
      capturedAt: '2026-11-11T12:00:00Z',
      rawSanitizedPayload: {},
      transparencyNotice: 'First capture',
    };

    const rec1 = buildReconciliationRecord({
      transfer: sampleTransfer,
      provider: 'PAYPAL_SANDBOX',
      quote: null,
      capture: capture1,
      baseCurrency: 'EUR',
    });

    // Second capture attempt with identical transfer
    const rec2 = buildReconciliationRecord({
      transfer: sampleTransfer,
      provider: 'PAYPAL_SANDBOX',
      quote: null,
      capture: capture1,
      baseCurrency: 'EUR',
    });

    expect(rec1.status).toBe('RECONCILIATION_COMPLETE');
    expect(rec2.status).toBe('RECONCILIATION_COMPLETE');
    expect(rec1.captureGrossAmount).toBe(rec2.captureGrossAmount);
    expect(rec1.captureFeeAmount).toBe(rec2.captureFeeAmount);
    expect(rec1.captureNetAmount).toBe(rec2.captureNetAmount);
  });
});
