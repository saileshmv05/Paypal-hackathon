import { describe, it, expect } from 'vitest';
import { PayPalCheckoutSandboxAdapter, DemoProviderAdapter } from '../server/paypal/adapters';
import { buildReconciliationRecord } from '../server/reconciliation/engine';
import { SettlementTransfer } from '../server/types';

describe('PayPal Adapter & Reconciliation Engine', () => {
  const sampleTransfer: SettlementTransfer = {
    id: 't-123',
    planId: 'p-1',
    fromMemberId: 'm-sam',
    fromMemberName: 'Sam',
    toMemberId: 'm-alex',
    toMemberName: 'Alex',
    amount: '150.00',
    currency: 'EUR',
    targetAmount: '150.00',
    targetCurrency: 'EUR',
    estimatedFee: '5.73',
    status: 'COMPLETED',
  };

  it('PayPalCheckoutSandboxAdapter reports quote unavailability honestly', async () => {
    const adapter = new PayPalCheckoutSandboxAdapter('fake-id', 'fake-secret');
    const quote = await adapter.getQuote({
      fromAmount: '150.00',
      fromCurrency: 'EUR',
      toCurrency: 'EUR',
    });

    expect(quote.isQuoteAvailable).toBe(false);
    expect(quote.status).toBe('UNAVAILABLE');
    expect(quote.unavailableReason).toMatch(/UNAUTHORIZED|HTTP|unavailable/i);
  });

  it('normalizes genuine PayPal Orders v2 capture responses safely', () => {
    const adapter = new PayPalCheckoutSandboxAdapter();
    const rawPaypalResponse = {
      id: 'ORDER-12345',
      status: 'COMPLETED',
      purchase_units: [
        {
          reference_id: 't-123',
          payments: {
            captures: [
              {
                id: 'CAP-7890',
                status: 'COMPLETED',
                amount: { currency_code: 'EUR', value: '150.00' },
                seller_receivable_breakdown: {
                  gross_amount: { currency_code: 'EUR', value: '150.00' },
                  paypal_fee: { currency_code: 'EUR', value: '5.73' },
                  net_amount: { currency_code: 'EUR', value: '144.27' },
                },
                create_time: '2026-11-05T10:00:00Z',
              },
            ],
          },
        },
      ],
      links: [{ rel: 'self', href: 'https://api.sandbox.paypal.com/...' }],
    };

    const normalized = adapter.normalizeTransactionResponse(rawPaypalResponse);
    expect(normalized.providerCaptureId).toBe('CAP-7890');
    expect(normalized.status).toBe('COMPLETED');
    expect(normalized.grossAmount).toBe('150.00');
    expect(normalized.feeAmount).toBe('5.73');
    expect(normalized.netAmount).toBe('144.27');
    expect(normalized.rawSanitizedPayload.links).toBeUndefined(); // Scrubbed!
  });

  it('builds transparent 4-way reconciliation record', () => {
    const demoCapture = {
      providerCaptureId: 'CAP-DEMO-1',
      status: 'COMPLETED' as const,
      grossAmount: '150.00',
      grossCurrency: 'EUR' as const,
      feeAmount: '5.73',
      feeCurrency: 'EUR' as const,
      netAmount: '144.27',
      netCurrency: 'EUR' as const,
      effectiveFxRate: null,
      receivableAmount: null,
      receivableCurrency: null,
      capturedAt: '2026-11-05T10:00:00Z',
      rawSanitizedPayload: {},
      transparencyNotice: 'Demo capture',
    };

    const recon = buildReconciliationRecord({
      transfer: sampleTransfer,
      provider: 'PAYPAL_SANDBOX',
      quote: null,
      capture: demoCapture,
      baseCurrency: 'EUR',
    });

    expect(recon.status).toBe('RECONCILIATION_COMPLETE');
    expect(recon.ledgerOriginalAmount).toBe('150.00');
    expect(recon.ledgerConvertedBaseAmount).toBe('150.00');
    expect(recon.captureGrossAmount).toBe('150.00');
    expect(recon.observedProviderFee).toBe('5.73');
    expect(recon.diffLedgerVsCaptureGross).toBe('0.00'); // Exact match on gross!
    expect(recon.explanation).toContain('Net proceeds credited to payee: 144.27 EUR');
    expect(recon.unobservableChargesEstimate).toContain('Unobservable');
  });

  it('flags failed captures without claiming payment success', () => {
    const failedCapture = {
      providerCaptureId: 'CAP-FAILED-1',
      status: 'FAILED' as const,
      grossAmount: '150.00',
      grossCurrency: 'EUR' as const,
      feeAmount: '0.00',
      feeCurrency: 'EUR' as const,
      netAmount: '0.00',
      netCurrency: 'EUR' as const,
      effectiveFxRate: null,
      receivableAmount: null,
      receivableCurrency: null,
      capturedAt: '2026-11-05T10:00:00Z',
      rawSanitizedPayload: {},
      transparencyNotice: 'Failed capture',
    };

    const recon = buildReconciliationRecord({
      transfer: sampleTransfer,
      provider: 'PAYPAL_SANDBOX',
      quote: null,
      capture: failedCapture,
      baseCurrency: 'EUR',
    });

    expect(recon.status).toBe('CAPTURE_FAILED');
    expect(recon.explanation).toContain('failed or was rejected');
  });
});
