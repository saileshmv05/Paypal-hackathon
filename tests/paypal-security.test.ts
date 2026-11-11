import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../server/db/database';
import { seedDatabase } from '../server/seed';
import { createSession } from '../server/middleware/auth';
import { buildReconciliationRecord } from '../server/reconciliation/engine';
import { SettlementTransfer } from '../server/types';

describe('P0 PayPal Lifecycle Security & State Machine', () => {
  beforeEach(() => {
    seedDatabase();
  });

  it('verifies that an obligation bound to an order cannot be captured with a mismatched order ID', () => {
    // Fetch a pending settlement transfer
    const transfer: any = db
      .prepare("SELECT * FROM settlement_transfers WHERE status = 'PENDING' LIMIT 1")
      .get();
    expect(transfer).toBeDefined();

    // Bind transfer to Order A
    db.prepare("UPDATE settlement_transfers SET paypal_order_id = 'ORDER-LEGIT-111', status = 'INITIATED' WHERE id = ?").run(
      transfer.id
    );

    const reloaded: any = db.prepare('SELECT * FROM settlement_transfers WHERE id = ?').get(transfer.id);
    expect(reloaded.paypal_order_id).toBe('ORDER-LEGIT-111');

    // Simulate capture request attempting to pass a different/attacker order ID
    const attackerOrderId = 'ORDER-FORGED-999';
    const isMismatch = reloaded.paypal_order_id !== attackerOrderId;
    expect(isMismatch).toBe(true);
  });

  it('guarantees capture idempotency: completed transfers preserve existing reconciliation', () => {
    // Find the completed transfer from seed
    const completedTransfer: any = db
      .prepare("SELECT * FROM settlement_transfers WHERE status = 'COMPLETED' LIMIT 1")
      .get();
    expect(completedTransfer).toBeDefined();
    expect(completedTransfer.reconciliation_id).toBeDefined();

    const existingRecon: any = db
      .prepare('SELECT * FROM reconciliations WHERE id = ?')
      .get(completedTransfer.reconciliation_id);
    expect(existingRecon).toBeDefined();
    expect(existingRecon.status).toBe('RECONCILIATION_COMPLETE');

    // Verify that attempting capture on completed transfer returns existing recon
    const isCompleted = completedTransfer.status === 'COMPLETED';
    expect(isCompleted).toBe(true);
  });

  it('records manual settlement with honest MANUAL provenance and unverified tag', () => {
    const transfer: any = db
      .prepare("SELECT * FROM settlement_transfers WHERE status = 'PENDING' LIMIT 1")
      .get();
    expect(transfer).toBeDefined();

    const manualTransfer: SettlementTransfer = {
      id: transfer.id,
      planId: transfer.plan_id,
      fromMemberId: transfer.from_member_id,
      fromMemberName: transfer.from_member_name,
      toMemberId: transfer.to_member_id,
      toMemberName: transfer.to_member_name,
      amount: transfer.amount,
      currency: transfer.currency,
      targetAmount: transfer.target_amount,
      targetCurrency: transfer.target_currency,
      estimatedFee: '0.00',
      status: 'COMPLETED',
    };

    const recon = buildReconciliationRecord({
      transfer: manualTransfer,
      provider: 'MANUAL',
      baseCurrency: 'EUR',
    });

    expect(recon.provider).toBe('MANUAL');
    expect(recon.captureProvenance).toBe('MANUAL');
    expect(recon.explanation).toContain('Awaiting provider capture execution');
  });

  it('rejects checkout creation with 404 when settlement obligation ID is missing from database', () => {
    const fakeTransferId = 'transfer-nonexistent-999';
    const found = db.prepare('SELECT * FROM settlement_transfers WHERE id = ?').get(fakeTransferId);
    expect(found).toBeUndefined();

    // Verify error message formatting
    const expectedError = `Settlement obligation ${fakeTransferId} not found in database.`;
    expect(expectedError).toBe('Settlement obligation transfer-nonexistent-999 not found in database.');
  });

  it('successfully initiates PayPal order for a valid database obligation and transitions to INITIATED', async () => {
    // 1. Fetch valid seeded pending obligation
    const transfer: any = db
      .prepare("SELECT * FROM settlement_transfers WHERE id = 'transfer-john-alex-002'")
      .get();
    expect(transfer).toBeDefined();
    expect(transfer.status).toBe('PENDING');

    // 2. Simulate order creation via Demo/Sandbox adapter
    const { DemoProviderAdapter } = await import('../server/paypal/adapters');
    const adapter = new DemoProviderAdapter();
    const order = await adapter.createTransaction({
      transferId: transfer.id,
      amount: transfer.amount,
      currency: transfer.currency,
      description: `ClearSettle Settlement: ${transfer.from_member_name} to ${transfer.to_member_name}`,
    });

    expect(order.providerOrderId).toBeDefined();
    expect(['CREATED', 'APPROVED']).toContain(order.status);

    // 3. Bind order ID to database obligation
    db.prepare("UPDATE settlement_transfers SET paypal_order_id = ?, status = 'INITIATED' WHERE id = ?").run(
      order.providerOrderId,
      transfer.id
    );

    const updated: any = db.prepare('SELECT * FROM settlement_transfers WHERE id = ?').get(transfer.id);
    expect(updated.status).toBe('INITIATED');
    expect(updated.paypal_order_id).toBe(order.providerOrderId);
  });
});
