import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from './db/database';
import { quantizeCurrency, splitAmountEqually } from './financial/currency';
import { convertCurrency, DEFAULT_REFERENCE_RATES_EUR_BASE, REFERENCE_RATE_METADATA } from './financial/rates';
import { CurrencyCode } from './types';
import { buildReconciliationRecord } from './reconciliation/engine';
import { DemoProviderAdapter } from './paypal/adapters';

export function seedDatabase() {
  initDatabase();

  // Clean existing demo data
  db.exec(`
    DELETE FROM audit_events;
    DELETE FROM reconciliations;
    DELETE FROM settlement_transfers;
    DELETE FROM settlement_plans;
    DELETE FROM expense_splits;
    DELETE FROM expenses;
    DELETE FROM ai_extractions;
    DELETE FROM group_members;
    DELETE FROM groups;
  `);

  console.log('Clearing database and populating realistic hackathon demonstration data...');

  const groupId = 'group-intl-trip-2026';
  const baseCurrency: CurrencyCode = 'EUR';

  // 1. Create Group
  db.prepare(`
    INSERT INTO groups (id, name, description, base_currency, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    groupId,
    'Tokyo & Munich Global Summit 2026 [DEMO]',
    'International team conference and travel across Germany, the US, and Japan. Demonstrates multi-currency reconciliation, exact decimal arithmetic, and PayPal merchant checkout.',
    baseCurrency,
    '2026-11-01T09:00:00Z'
  );

  // 2. Add Participants: Alex (EUR), Sam (USD), John (JPY)
  const alexId = 'member-alex-eur';
  const samId = 'member-sam-usd';
  const johnId = 'member-john-jpy';

  const insertMember = db.prepare(`
    INSERT INTO group_members (id, group_id, name, country, preferred_currency, email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertMember.run(alexId, groupId, 'Alex', 'Germany', 'EUR', 'alex.munich@example.com', '2026-11-01T09:05:00Z');
  insertMember.run(samId, groupId, 'Sam', 'United States', 'USD', 'sam.sf@example.com', '2026-11-01T09:06:00Z');
  insertMember.run(johnId, groupId, 'John', 'Japan', 'JPY', 'john.tokyo@example.com', '2026-11-01T09:07:00Z');

  const members = [
    { id: alexId, name: 'Alex', country: 'Germany', preferredCurrency: 'EUR' as CurrencyCode },
    { id: samId, name: 'Sam', country: 'United States', preferredCurrency: 'USD' as CurrencyCode },
    { id: johnId, name: 'John', country: 'Japan', preferredCurrency: 'JPY' as CurrencyCode },
  ];

  // Helper to insert an expense with exact splits
  function insertExpenseWithSplits(
    id: string,
    payerId: string,
    desc: string,
    category: string,
    origAmount: string,
    origCurrency: CurrencyCode,
    participantIds: string[],
    evidenceType: 'MANUAL' | 'RECEIPT' | 'CONVERSATION',
    evidenceRef: string,
    createdAt: string
  ) {
    const conv = convertCurrency(origAmount, origCurrency, baseCurrency);
    const baseTotal = conv.toAmount;

    db.prepare(`
      INSERT INTO expenses (
        id, group_id, payer_id, description, category,
        original_amount, original_currency, base_amount,
        exchange_rate, rate_source, rate_timestamp, rate_direction,
        split_type, evidence_type, evidence_ref, status,
        created_at, approved_at, approved_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      groupId,
      payerId,
      desc,
      category,
      origAmount,
      origCurrency,
      baseTotal,
      conv.effectiveRate,
      conv.rateSource,
      conv.rateTimestamp,
      conv.rateDirection,
      'EQUAL',
      evidenceType,
      evidenceRef,
      'APPROVED',
      createdAt,
      createdAt,
      'System Seed'
    );

    // Split equally among participants with zero lost cents
    const origShares = splitAmountEqually(origAmount, origCurrency, participantIds.length);
    const baseShares = splitAmountEqually(baseTotal, baseCurrency, participantIds.length);

    const insertSplit = db.prepare(`
      INSERT INTO expense_splits (id, expense_id, member_id, share_amount, share_base_amount)
      VALUES (?, ?, ?, ?, ?)
    `);

    for (let i = 0; i < participantIds.length; i++) {
      insertSplit.run(uuidv4(), id, participantIds[i], origShares[i], baseShares[i]);
    }

    // Audit Event
    db.prepare(`
      INSERT INTO audit_events (id, group_id, entity_type, entity_id, event_type, actor, description, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      groupId,
      'EXPENSE',
      id,
      'EXPENSE_APPROVED',
      'Alex',
      `Approved expense: ${desc} (${origAmount} ${origCurrency})`,
      JSON.stringify({ originalAmount: origAmount, originalCurrency: origCurrency, baseAmount: baseTotal, payerId }),
      createdAt
    );
  }

  // 1. Hotel Expense: Alex paid €450.00 EUR (Shared by Alex, Sam, John)
  insertExpenseWithSplits(
    'exp-hotel-001',
    alexId,
    'Grand Hyatt Conference Hotel Booking',
    'Accommodation',
    '450.00',
    'EUR',
    [alexId, samId, johnId],
    'RECEIPT',
    'invoice_hyatt_nov2026.pdf',
    '2026-11-02T14:30:00Z'
  );

  // 2. Restaurant Expense: John paid ¥25,268 JPY in Tokyo (Shared by Alex, Sam, John)
  // ¥25,268 JPY @ 168.45 JPY/EUR = €150.00 EUR
  insertExpenseWithSplits(
    'exp-restaurant-002',
    johnId,
    'Traditional Kaiseki Dinner & Drinks',
    'Food & Dining',
    '25268',
    'JPY',
    [alexId, samId, johnId],
    'RECEIPT',
    'tokyo_kaiseki_bill.jpg',
    '2026-11-03T20:15:00Z'
  );

  // 3. Transport Expense: Sam paid $162.75 USD for Shinkansen / Airport Express (Shared by Alex, Sam, John)
  // $162.75 USD @ 1.085 USD/EUR = €150.00 EUR
  insertExpenseWithSplits(
    'exp-transport-003',
    samId,
    'Airport Express & High-speed Transit Passes',
    'Transit',
    '162.75',
    'USD',
    [alexId, samId, johnId],
    'RECEIPT',
    'transit_passes_receipt.pdf',
    '2026-11-04T11:00:00Z'
  );

  // 4. Pre-seeded AI Extraction Review Queue:
  // Demonstrating:
  // - Confirmed expense
  // - Reimbursement already transferred
  // - Payment promise
  // - Disputed expense / Unresolved statement
  const insertAI = db.prepare(`
    INSERT INTO ai_extractions (
      id, group_id, classification, confidence_score,
      payer_name, payer_id, involved_members, amount, currency,
      description, date, source_text, split_type, missing_information,
      explanation, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // Item A: Reimbursement already transferred
  insertAI.run(
    'ai-item-repay-001',
    groupId,
    'REPAYMENT',
    0.96,
    'John',
    johnId,
    JSON.stringify(['John', 'Alex']),
    '100.00',
    'EUR',
    'Direct reimbursement from John to Alex',
    '2026-11-05',
    'John: I already transferred €100 yesterday.',
    'EQUAL',
    JSON.stringify(['Payee bank confirmation receipt']),
    'Participant John confirmed completing an external transfer of €100 to Alex. Recorded as debt repayment rather than new group expenditure.',
    'PENDING_REVIEW',
    '2026-11-05T08:30:00Z'
  );

  // Item B: Payment Promise
  insertAI.run(
    'ai-item-promise-002',
    groupId,
    'PAYMENT_PROMISE',
    0.93,
    'Sam',
    samId,
    JSON.stringify(['Sam', 'Alex']),
    '150.00',
    'EUR',
    'Promised settlement payment from Sam to Alex',
    '2026-11-05',
    "Sam: I'll send you €150.",
    'EQUAL',
    JSON.stringify(['Payment execution pending', 'Observable transaction capture']),
    'Statement expresses intention to pay ("I will send"), not an executed financial transfer. Held in review queue to prevent premature debt write-down.',
    'PENDING_REVIEW',
    '2026-11-05T08:32:00Z'
  );

  // Item C: Disputed / Unresolved Expense
  insertAI.run(
    'ai-item-dispute-003',
    groupId,
    'UNRESOLVED',
    0.68,
    'Alex',
    alexId,
    JSON.stringify(['Alex', 'John', 'Sam']),
    '75.00',
    'EUR',
    'Dinner invoice (Disputed payer responsibility)',
    '2026-11-05',
    "Alex: Dinner was another €75.\nSam: Wait, John was supposed to cover dinner.",
    'EQUAL',
    JSON.stringify(['Payer responsibility contested', 'Group consensus required']),
    'Conflicting statements: Alex reported paying €75 for dinner, but Sam immediately noted John was assigned to cover it. Flagged as UNRESOLVED to safeguard accounting integrity.',
    'PENDING_REVIEW',
    '2026-11-05T08:35:00Z'
  );

  // 5. Pre-seed a Settlement Plan & Reconciled PayPal Transaction
  // To allow judges to immediately explore the Payment Reconciliation centerpiece!
  const planId = 'plan-initial-demo';
  db.prepare(`
    INSERT INTO settlement_plans (id, group_id, strategy, total_debt_volume_base, estimated_fee_cost_base, zero_sum_subsets_count, explanation, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    planId,
    groupId,
    'MIN_TRANSFERS',
    '150.00',
    '5.73',
    1,
    'Initial settlement recommendation: Sam pays Alex €150.00 via PayPal Checkout Sandbox.',
    '2026-11-05T09:00:00Z'
  );

  const transferId = 'transfer-sam-alex-001';
  db.prepare(`
    INSERT INTO settlement_transfers (
      id, plan_id, from_member_id, from_member_name,
      to_member_id, to_member_name, amount, currency,
      target_amount, target_currency, estimated_fee, status,
      paypal_order_id, reconciliation_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    transferId,
    planId,
    samId,
    'Sam',
    alexId,
    'Alex',
    '150.00',
    'EUR',
    '150.00',
    'EUR',
    '5.73',
    'COMPLETED',
    'DEMO-ORDER-7729B1A',
    'recon-sam-alex-001'
  );

  // Generate realistic reconciliation record for transfer-sam-alex-001
  const demoAdapter = new DemoProviderAdapter();
  const mockCapture = {
    providerCaptureId: 'SANDBOX_CAP-9A721094E1',
    status: 'COMPLETED' as const,
    grossAmount: '150.00',
    grossCurrency: 'EUR' as CurrencyCode,
    feeAmount: '5.73',
    feeCurrency: 'EUR' as CurrencyCode,
    netAmount: '144.27',
    netCurrency: 'EUR' as CurrencyCode,
    effectiveFxRate: null,
    receivableAmount: null,
    receivableCurrency: null,
    capturedAt: '2026-11-05T10:14:22Z',
    rawSanitizedPayload: {
      id: 'SANDBOX_CAP-9A721094E1',
      status: 'COMPLETED',
      amount: { currency_code: 'EUR', value: '150.00' },
      seller_receivable_breakdown: {
        gross_amount: { currency_code: 'EUR', value: '150.00' },
        paypal_fee: { currency_code: 'EUR', value: '5.73' },
        net_amount: { currency_code: 'EUR', value: '144.27' },
      },
      create_time: '2026-11-05T10:14:22Z',
    },
    transparencyNotice:
      'Server-verified PayPal Sandbox capture. Merchant Checkout order model: Funds credited to seller merchant balance minus PayPal transaction processing fee.',
  };

  const sampleTransfer = {
    id: transferId,
    planId,
    fromMemberId: samId,
    fromMemberName: 'Sam',
    toMemberId: alexId,
    toMemberName: 'Alex',
    amount: '150.00',
    currency: 'EUR' as CurrencyCode,
    targetAmount: '150.00',
    targetCurrency: 'EUR' as CurrencyCode,
    estimatedFee: '5.73',
    status: 'COMPLETED' as const,
  };

  const recon = buildReconciliationRecord({
    transfer: sampleTransfer,
    provider: 'DEMO_PROVIDER',
    quote: {
      isQuoteAvailable: false,
      quoteId: null,
      quotedAmount: null,
      quotedCurrency: null,
      providerFxRate: null,
      expiresAt: null,
      status: 'UNAVAILABLE',
      unavailableReason: 'Provider quote unavailable — no verified quotation was returned.',
      transparencyNote:
        'Standard developer merchant sandbox accounts do not provide pre-capture binding quotes. (Simulated Demo Model)',
    },
    capture: mockCapture,
    baseCurrency: 'EUR',
  });

  db.prepare(`
    INSERT INTO reconciliations (
      id, transfer_id, transaction_id, provider, status, capture_provenance,
      ledger_original_amount, ledger_original_currency,
      ledger_reference_rate, ledger_rate_source, ledger_rate_timestamp,
      ledger_converted_base_amount, ledger_base_currency,
      quote_amount, quote_currency, quote_fx_rate, quote_id, quote_expires_at, quote_status,
      capture_id, capture_gross_amount, capture_gross_currency,
      capture_fee_amount, capture_fee_currency, capture_net_amount, capture_net_currency,
      capture_effective_rate, capture_receivable_amount, capture_receivable_currency,
      capture_timestamp, diff_ledger_vs_capture_gross, diff_quote_vs_capture_gross,
      observed_provider_fee, unobservable_charges_estimate, explanation, created_at
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?, ?
    )
  `).run(
    'recon-sam-alex-001',
    transferId,
    'SANDBOX_CAP-9A721094E1',
    'DEMO_PROVIDER',
    recon.status,
    'SIMULATED',
    recon.ledgerOriginalAmount,
    recon.ledgerOriginalCurrency,
    recon.ledgerReferenceRate,
    recon.ledgerRateSource,
    recon.ledgerRateTimestamp,
    recon.ledgerConvertedBaseAmount,
    recon.ledgerBaseCurrency,
    recon.quoteAmount,
    recon.quoteCurrency,
    recon.quoteFxRate,
    recon.quoteId,
    recon.quoteExpiresAt,
    recon.quoteStatus,
    recon.captureId,
    recon.captureGrossAmount,
    recon.captureGrossCurrency,
    recon.captureFeeAmount,
    recon.captureFeeCurrency,
    recon.captureNetAmount,
    recon.captureNetCurrency,
    recon.captureEffectiveRate,
    recon.captureReceivableAmount,
    recon.captureReceivableCurrency,
    recon.captureTimestamp,
    recon.diffLedgerVsCaptureGross,
    recon.diffQuoteVsCaptureGross,
    recon.observedProviderFee,
    recon.unobservableChargesEstimate,
    recon.explanation,
    '2026-11-05T10:15:00Z'
  );

  // Audit event for the settlement capture
  db.prepare(`
    INSERT INTO audit_events (id, group_id, entity_type, entity_id, event_type, actor, description, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    groupId,
    'SETTLEMENT',
    transferId,
    'PAYPAL_CAPTURE_CONFIRMED',
    'Sam',
    'PayPal Sandbox order captured server-side: SANDBOX_CAP-9A721094E1. Fee: €5.73 EUR. Net: €144.27 EUR.',
    JSON.stringify(mockCapture),
    '2026-11-05T10:15:00Z'
  );

  console.log('Seeding completed successfully!');
}

if (require.main === module) {
  seedDatabase();
}
