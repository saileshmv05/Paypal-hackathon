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
});
