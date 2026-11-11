import { describe, it, expect, beforeEach } from 'vitest';
import Decimal from 'decimal.js';
import { db } from '../server/db/database';
import { seedDatabase } from '../server/seed';
import { convertCurrency } from '../server/financial/rates';
import { buildReconciliationRecord } from '../server/reconciliation/engine';
import { SettlementTransfer } from '../server/types';

describe('Small Business Invoicing & Payment Reconciliation', () => {
  beforeEach(() => {
    seedDatabase();
  });

  it('retrieves workspace and invoices with authoritative DB amounts', () => {
    const workspace: any = db.prepare('SELECT * FROM workspaces WHERE id = ?').get('workspace-agency-demo');
    expect(workspace).toBeDefined();
    expect(workspace.name).toBe('Apex Creative Digital Agency');
    expect(workspace.base_currency).toBe('EUR');

    const invoices: any[] = db
      .prepare('SELECT * FROM invoices WHERE workspace_id = ? ORDER BY invoice_number ASC')
      .all('workspace-agency-demo');

    expect(invoices.length).toBe(2);
    expect(invoices[0].invoice_number).toBe('INV-2026-081');
    expect(invoices[0].status).toBe('PAID');
    expect(invoices[0].amount).toBe('2500.00');

    expect(invoices[1].invoice_number).toBe('INV-2026-082');
    expect(invoices[1].status).toBe('ISSUED');
    expect(invoices[1].amount).toBe('1800.00');
  });

  it('reconciles business client payment with gross capture vs net proceeds audit', () => {
    const mockInvoiceTransfer: SettlementTransfer = {
      id: 'inv-test-01',
      planId: 'workspace-agency-demo',
      fromMemberId: 'client-1',
      fromMemberName: 'Nordic Innovations Oy',
      toMemberId: 'workspace-agency-demo',
      toMemberName: 'Apex Creative Digital Agency',
      amount: '2500.00',
      currency: 'EUR',
      targetAmount: '2500.00',
      targetCurrency: 'EUR',
      estimatedFee: '92.25',
      status: 'COMPLETED',
    };

    const mockCapture = {
      providerCaptureId: 'SANDBOX_CAP-INV81',
      grossAmount: '2500.00',
      grossCurrency: 'EUR' as const,
      feeAmount: '92.25',
      feeCurrency: 'EUR' as const,
      netAmount: '2407.75',
      netCurrency: 'EUR' as const,
      status: 'COMPLETED' as const,
      capturedAt: new Date().toISOString(),
      effectiveFxRate: null,
      receivableAmount: null,
      receivableCurrency: null,
      transparencyNotice: 'Verified PayPal Sandbox Capture',
      rawSanitizedPayload: { id: 'SANDBOX_CAP-INV81' },
    };

    const recon = buildReconciliationRecord({
      transfer: mockInvoiceTransfer,
      provider: 'PAYPAL_SANDBOX',
      capture: mockCapture,
      baseCurrency: 'EUR',
    });

    expect(recon.status).toBe('RECONCILIATION_COMPLETE');
    expect(recon.matchStatus).toBe('MATCHED');
    expect(recon.diffLedgerVsCaptureGross).toBe('0.00');
    expect(recon.observedProviderFee).toBe('92.25');
    expect(recon.captureNetAmount).toBe('2407.75');

    // Decision trace plain-language summary check
    expect(recon.decisionTrace).toBeDefined();
    expect(recon.decisionTrace?.expectedAmount).toBe('2500.00 EUR');
    expect(recon.decisionTrace?.capturedGross).toBe('2500.00 EUR');
    expect(recon.decisionTrace?.netReceived).toBe('2407.75 EUR');
    expect(recon.decisionTrace?.summary).toContain('matches');
  });

  it('correctly detects underpayment when client capture is lower than invoice amount', () => {
    const mockInvoiceTransfer: SettlementTransfer = {
      id: 'inv-test-short',
      planId: 'workspace-agency-demo',
      fromMemberId: 'client-1',
      fromMemberName: 'Nordic Innovations Oy',
      toMemberId: 'workspace-agency-demo',
      toMemberName: 'Apex Creative Digital Agency',
      amount: '2500.00',
      currency: 'EUR',
      targetAmount: '2500.00',
      targetCurrency: 'EUR',
      estimatedFee: '75.00',
      status: 'COMPLETED',
    };

    const shortCapture = {
      providerCaptureId: 'SANDBOX_CAP-SHORT',
      grossAmount: '2000.00', // Client only paid 2000 out of 2500
      grossCurrency: 'EUR' as const,
      feeAmount: '74.19',
      feeCurrency: 'EUR' as const,
      netAmount: '1925.81',
      netCurrency: 'EUR' as const,
      status: 'COMPLETED' as const,
      capturedAt: new Date().toISOString(),
      effectiveFxRate: null,
      receivableAmount: null,
      receivableCurrency: null,
      transparencyNotice: 'Partial capture',
      rawSanitizedPayload: { id: 'SANDBOX_CAP-SHORT' },
    };

    const recon = buildReconciliationRecord({
      transfer: mockInvoiceTransfer,
      provider: 'PAYPAL_SANDBOX',
      capture: shortCapture,
      baseCurrency: 'EUR',
    });

    expect(recon.matchStatus).toBe('UNDERPAID');
    expect(recon.decisionTrace?.variance).toBe('-500.00 EUR');
    expect(recon.decisionTrace?.summary).toContain('Underpayment');
  });
});
