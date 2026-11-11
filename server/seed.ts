import Decimal from 'decimal.js';
import { v4 as uuidv4 } from 'uuid';
import { db, initDatabase } from './db/database';
import { quantizeCurrency, splitAmountEqually } from './financial/currency';
import { convertCurrency, DEFAULT_REFERENCE_RATES_EUR_BASE, REFERENCE_RATE_METADATA } from './financial/rates';
import { CurrencyCode, SettlementTransfer } from './types';
import { buildReconciliationRecord } from './reconciliation/engine';
import { DemoProviderAdapter } from './paypal/adapters';
import { recordAuditEvent } from './audit/chain';

export function seedDatabase() {
  initDatabase();

  // Clean existing demo data safely
  db.pragma('foreign_keys = OFF');
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
    DELETE FROM invoices;
    DELETE FROM clients;
    DELETE FROM workspaces;
  `);
  db.pragma('foreign_keys = ON');

  console.log('Clearing database and populating realistic hackathon demonstration data...');

  const groupId = 'group-intl-trip-2026';
  const baseCurrency: CurrencyCode = 'EUR';

  // 1. Create Group (Personal Travel)
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

  recordAuditEvent({
    groupId,
    entityType: 'GROUP',
    entityId: groupId,
    eventType: 'GROUP_CREATED',
    actor: 'System Admin',
    description: 'Initialized group "Tokyo & Munich Global Summit 2026" with base currency EUR',
    metadata: { baseCurrency, membersCount: 3 },
  });

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
      'Alex (Admin)'
    );

    // Calculate exact integer minor unit shares
    const shares = splitAmountEqually(origAmount, origCurrency, participantIds.length);

    const insertSplit = db.prepare(`
      INSERT INTO expense_splits (id, expense_id, member_id, share_amount, share_base_amount)
      VALUES (?, ?, ?, ?, ?)
    `);

    participantIds.forEach((mId, idx) => {
      const shareOrig = shares[idx];
      const shareBaseConv = convertCurrency(shareOrig, origCurrency, baseCurrency);
      insertSplit.run(uuidv4(), id, mId, shareOrig, shareBaseConv.toAmount);
    });

    recordAuditEvent({
      groupId,
      entityType: 'EXPENSE',
      entityId: id,
      eventType: 'EXPENSE_APPROVED',
      actor: 'Alex (Admin)',
      description: `Approved expense "${desc}" for ${origAmount} ${origCurrency} (${baseTotal} EUR base)`,
      metadata: { originalAmount: origAmount, originalCurrency: origCurrency, baseAmount: baseTotal },
    });
  }

  // 3. Populate Seeded Group Expenses
  insertExpenseWithSplits(
    'exp-berlin-hotel',
    alexId,
    'Grand Hotel Berlin Accommodation (3 nights)',
    'Accommodation',
    '450.00',
    'EUR',
    [alexId, samId, johnId],
    'RECEIPT',
    'Receipt #BER-9941 (VAT registered)',
    '2026-11-02T14:30:00Z'
  );

  insertExpenseWithSplits(
    'exp-shibuya-dinner',
    alexId,
    'Tokyo Shibuya Team Welcome Dinner & Izakaya',
    'Meals & Dining',
    '75.00',
    'EUR',
    [alexId, samId, johnId],
    'CONVERSATION',
    'Chat transcript line 4: "Dinner was another €75"',
    '2026-11-03T20:15:00Z'
  );

  insertExpenseWithSplits(
    'exp-tokyo-transit',
    johnId,
    'Tokyo Shinkansen Bullet Train & Pasmo IC Passes',
    'Transport',
    '33690',
    'JPY',
    [alexId, samId, johnId],
    'RECEIPT',
    'JR East Transit Slip #JR-8820',
    '2026-11-04T08:45:00Z'
  );

  insertExpenseWithSplits(
    'exp-sf-workshop',
    samId,
    'Cloud API & Sandbox Architecture Workshop Co-working Pass',
    'Workspace',
    '150.00',
    'USD',
    [alexId, samId, johnId],
    'MANUAL',
    'Stripe Invoice #INV-SF-2026',
    '2026-11-04T16:00:00Z'
  );

  // 4. Populate AI Extraction Review Queue
  const insertAI = db.prepare(`
    INSERT INTO ai_extractions (
      id, group_id, classification, confidence_score, payer_name, payer_id,
      involved_members, amount, currency, description, date, source_text,
      split_type, missing_information, explanation, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertAI.run(
    'ai-extract-001',
    groupId,
    'CONFIRMED_EXPENSE',
    0.95,
    'Alex',
    alexId,
    JSON.stringify(['Alex', 'Sam', 'John']),
    '450.00',
    'EUR',
    'Grand Hotel Berlin Accommodation',
    '2026-11-02',
    'Alex: I paid €450 for the hotel.',
    'EQUAL',
    JSON.stringify([]),
    'Explicit past-tense declaration of payment with specified amount (€450) and identified payer (Alex).',
    'APPROVED',
    '2026-11-02T14:31:00Z'
  );

  insertAI.run(
    'ai-extract-002',
    groupId,
    'PAYMENT_PROMISE',
    0.92,
    'Sam',
    samId,
    JSON.stringify(['Alex', 'Sam']),
    '150.00',
    'EUR',
    'Promised hotel share reimbursement to Alex',
    '2026-11-02',
    'Sam: I\'ll send you €150.',
    'EQUAL',
    JSON.stringify(['Transaction pending execution', 'Payment capture confirmation']),
    'Future-tense commitment ("I\'ll send") expresses intention to pay, NOT an executed transaction. Must not be booked as settled cash.',
    'PENDING_REVIEW',
    '2026-11-02T14:32:00Z'
  );

  insertAI.run(
    'ai-extract-003',
    groupId,
    'REPAYMENT',
    0.91,
    'John',
    johnId,
    JSON.stringify(['John', 'Alex']),
    '100.00',
    'EUR',
    'Reimbursement transfer from John to Alex',
    '2026-11-01',
    'John: I already transferred €100 yesterday.',
    'EXACT',
    JSON.stringify(['Confirmation of receipt by Alex required']),
    'Statement confirms a prior executed debt settlement between two members. Settles existing debt rather than creating a new group expenditure.',
    'PENDING_REVIEW',
    '2026-11-02T14:33:00Z'
  );

  insertAI.run(
    'ai-extract-004',
    groupId,
    'UNRESOLVED',
    0.93,
    null,
    null,
    JSON.stringify(['John', 'Alex', 'Sam']),
    '75.00',
    'EUR',
    'Dinner Expense Allocation Dispute',
    '2026-11-03',
    'Sam: Wait, John was supposed to cover dinner.',
    'EQUAL',
    JSON.stringify(['Payer identity contested', 'Unresolved financial agreement between members']),
    'Ambiguous and contested obligation. Sam questions whether Alex should have paid dinner or if John was responsible. Excluded from ledger balance until reviewed.',
    'PENDING_REVIEW',
    '2026-11-03T20:16:00Z'
  );

  // 5. Seed Settlement Plan & Verified PayPal Capture
  const planId = 'plan-min-transfers-001';
  db.prepare(`
    INSERT INTO settlement_plans (id, group_id, strategy, total_debt_volume_base, estimated_fee_cost_base, zero_sum_subsets_count, explanation, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    planId,
    groupId,
    'MIN_TRANSFERS',
    '217.00',
    '5.73',
    1,
    'Calculated using Zero-Sum Partition Theorem: 3 participants partitioned into 1 zero-sum group. Exact minimum transfers required = 3 - 1 = 2 transfers.',
    '2026-11-05T10:00:00Z'
  );

  const transferId = 'transfer-sam-alex-001';
  db.prepare(`
    INSERT INTO settlement_transfers (
      id, plan_id, from_member_id, from_member_name, to_member_id, to_member_name,
      amount, currency, target_amount, target_currency, estimated_fee, status,
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
    'SANDBOX_ORD-7X298310',
    'recon-sam-alex-001'
  );

  // Transfer 2: John to Alex
  db.prepare(`
    INSERT INTO settlement_transfers (
      id, plan_id, from_member_id, from_member_name, to_member_id, to_member_name,
      amount, currency, target_amount, target_currency, estimated_fee, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'transfer-john-alex-002',
    planId,
    johnId,
    'John',
    alexId,
    'Alex',
    '11286',
    'JPY',
    '67.00',
    'EUR',
    '2.83',
    'PENDING'
  );

  // High-fidelity capture payload
  const mockCapture = {
    providerCaptureId: 'SANDBOX_CAP-9A721094E1',
    grossAmount: '150.00',
    grossCurrency: 'EUR' as CurrencyCode,
    feeAmount: '5.73',
    feeCurrency: 'EUR' as CurrencyCode,
    netAmount: '144.27',
    netCurrency: 'EUR' as CurrencyCode,
    status: 'COMPLETED' as const,
    capturedAt: '2026-11-05T10:14:22Z',
    effectiveFxRate: null,
    receivableAmount: null,
    receivableCurrency: null,
    transparencyNotice: 'Demonstration verified PayPal sandbox capture for seed state.',
    rawSanitizedPayload: {
      id: 'SANDBOX_CAP-9A721094E1',
      status: 'COMPLETED',
      amount: { value: '150.00', currency_code: 'EUR' },
      seller_receivable_breakdown: {
        gross_amount: { value: '150.00', currency_code: 'EUR' },
        paypal_fee: { value: '5.73', currency_code: 'EUR' },
        net_amount: { value: '144.27', currency_code: 'EUR' },
      },
    },
  };

  const sampleTransfer: SettlementTransfer = {
    id: transferId,
    planId,
    fromMemberId: samId,
    fromMemberName: 'Sam',
    toMemberId: alexId,
    toMemberName: 'Alex',
    amount: '150.00',
    currency: 'EUR',
    targetAmount: '150.00',
    targetCurrency: 'EUR',
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
      observed_provider_fee, unobservable_charges_estimate, explanation, match_status, decision_trace, created_at
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
      ?, ?, ?, ?, ?, ?
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
    recon.matchStatus || 'MATCHED',
    JSON.stringify(recon.decisionTrace || {}),
    '2026-11-05T10:15:00Z'
  );

  recordAuditEvent({
    groupId,
    entityType: 'SETTLEMENT',
    entityId: transferId,
    eventType: 'PAYPAL_CAPTURE_CONFIRMED',
    actor: 'Sam',
    description: 'PayPal Sandbox order captured server-side: SANDBOX_CAP-9A721094E1. Gross: €150.00 EUR. Fee: €5.73 EUR. Net: €144.27 EUR.',
    metadata: mockCapture,
  });

  // =========================================================================
  // 6. SEED SMALL BUSINESS WORKSPACE & CLIENT INVOICING OBLIGATIONS
  // =========================================================================
  const workspaceId = 'workspace-agency-demo';
  db.prepare(`
    INSERT INTO workspaces (id, name, type, base_currency, owner_name, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    workspaceId,
    'Apex Creative Digital Agency',
    'BUSINESS',
    'EUR',
    'Alex (Agency Founder)',
    'Full-service software architecture, UX consulting, and international digital production studio.',
    '2026-11-01T08:00:00Z'
  );

  // Add Client
  const clientId = 'client-nordic-eur';
  db.prepare(`
    INSERT INTO clients (id, workspace_id, name, email, company, country, preferred_currency, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    clientId,
    workspaceId,
    'Eero Korhonen',
    'eero@nordicinnovations.fi',
    'Nordic Innovations Oy',
    'Finland',
    'EUR',
    '2026-11-01T08:30:00Z'
  );

  // Add Client 2 (US Client)
  const client2Id = 'client-pacifica-usd';
  db.prepare(`
    INSERT INTO clients (id, workspace_id, name, email, company, country, preferred_currency, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    client2Id,
    workspaceId,
    'Sarah Jenkins',
    'sarah@pacificamedia.io',
    'Pacifica Media Labs LLC',
    'United States',
    'USD',
    '2026-11-01T08:35:00Z'
  );

  // Seed Paid Invoice (INV-2026-081)
  const inv1Id = 'inv-2026-001';
  db.prepare(`
    INSERT INTO invoices (
      id, workspace_id, invoice_number, client_name, client_email, description,
      amount, currency, base_amount, issue_date, due_date, status, paid_amount,
      paypal_order_id, reconciliation_id, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    inv1Id,
    workspaceId,
    'INV-2026-081',
    'Nordic Innovations Oy',
    'eero@nordicinnovations.fi',
    'Cross-Border Platform Architecture & AI Integration',
    '2500.00',
    'EUR',
    '2500.00',
    '2026-11-01',
    '2026-11-15',
    'PAID',
    '2500.00',
    'SANDBOX_ORD-INV81-99',
    'recon-inv-081',
    '2026-11-01T09:00:00Z'
  );

  // Seed Reconciliation for Invoice 1
  const invRecon = buildReconciliationRecord({
    transfer: {
      id: inv1Id,
      planId: workspaceId,
      fromMemberId: clientId,
      fromMemberName: 'Nordic Innovations Oy',
      toMemberId: workspaceId,
      toMemberName: 'Apex Creative Digital Agency',
      amount: '2500.00',
      currency: 'EUR',
      targetAmount: '2500.00',
      targetCurrency: 'EUR',
      estimatedFee: '92.25',
      status: 'COMPLETED',
    },
    provider: 'DEMO_PROVIDER',
    capture: {
      providerCaptureId: 'SANDBOX_CAP-INV81-CAPTURE',
      grossAmount: '2500.00',
      grossCurrency: 'EUR',
      feeAmount: '92.25',
      feeCurrency: 'EUR',
      netAmount: '2407.75',
      netCurrency: 'EUR',
      status: 'COMPLETED',
      capturedAt: '2026-11-03T11:20:00Z',
      effectiveFxRate: null,
      receivableAmount: null,
      receivableCurrency: null,
      transparencyNotice: 'Demonstration verified PayPal sandbox capture for seed state.',
      rawSanitizedPayload: {
        id: 'SANDBOX_CAP-INV81-CAPTURE',
        status: 'COMPLETED',
        seller_receivable_breakdown: {
          gross_amount: { value: '2500.00', currency_code: 'EUR' },
          paypal_fee: { value: '92.25', currency_code: 'EUR' },
          net_amount: { value: '2407.75', currency_code: 'EUR' },
        },
      },
    },
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
      observed_provider_fee, unobservable_charges_estimate, explanation, match_status, decision_trace, created_at
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
      ?, ?, ?, ?, ?, ?
    )
  `).run(
    'recon-inv-081',
    inv1Id,
    'SANDBOX_CAP-INV81-CAPTURE',
    'DEMO_PROVIDER',
    invRecon.status,
    'SIMULATED',
    invRecon.ledgerOriginalAmount,
    invRecon.ledgerOriginalCurrency,
    invRecon.ledgerReferenceRate,
    invRecon.ledgerRateSource,
    invRecon.ledgerRateTimestamp,
    invRecon.ledgerConvertedBaseAmount,
    invRecon.ledgerBaseCurrency,
    invRecon.quoteAmount,
    invRecon.quoteCurrency,
    invRecon.quoteFxRate,
    invRecon.quoteId,
    invRecon.quoteExpiresAt,
    invRecon.quoteStatus,
    invRecon.captureId,
    invRecon.captureGrossAmount,
    invRecon.captureGrossCurrency,
    invRecon.captureFeeAmount,
    invRecon.captureFeeCurrency,
    invRecon.captureNetAmount,
    invRecon.captureNetCurrency,
    invRecon.captureEffectiveRate,
    invRecon.captureReceivableAmount,
    invRecon.captureReceivableCurrency,
    invRecon.captureTimestamp,
    invRecon.diffLedgerVsCaptureGross,
    invRecon.diffQuoteVsCaptureGross,
    invRecon.observedProviderFee,
    invRecon.unobservableChargesEstimate,
    invRecon.explanation,
    'MATCHED',
    JSON.stringify(invRecon.decisionTrace || {}),
    '2026-11-03T11:21:00Z'
  );

  recordAuditEvent({
    groupId: workspaceId,
    entityType: 'INVOICE',
    entityId: inv1Id,
    eventType: 'INVOICE_PAID_RECONCILED',
    actor: 'PayPal Checkout Gateway',
    description: 'Captured client payment for INV-2026-081. Gross: €2500.00 EUR. Processor fee: €92.25 EUR. Net proceeds: €2407.75 EUR.',
    metadata: { gross: '2500.00', fee: '92.25', net: '2407.75' },
  });

  // Seed Issued / Pending Invoice (INV-2026-082)
  const inv2Id = 'inv-2026-002';
  db.prepare(`
    INSERT INTO invoices (
      id, workspace_id, invoice_number, client_name, client_email, description,
      amount, currency, base_amount, issue_date, due_date, status, paid_amount, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    inv2Id,
    workspaceId,
    'INV-2026-082',
    'Pacifica Media Labs LLC',
    'sarah@pacificamedia.io',
    'UX Design System & Multicurrency Financial Wireframes',
    '1800.00',
    'USD',
    '1658.99',
    '2026-11-05',
    '2026-11-20',
    'ISSUED',
    '0.00',
    '2026-11-05T14:00:00Z'
  );

  recordAuditEvent({
    groupId: workspaceId,
    entityType: 'INVOICE',
    entityId: inv2Id,
    eventType: 'INVOICE_ISSUED',
    actor: 'Alex (Agency Founder)',
    description: 'Issued invoice INV-2026-082 to Pacifica Media Labs LLC for $1800.00 USD (Base: €1658.99 EUR)',
    metadata: { amount: '1800.00', currency: 'USD' },
  });

  console.log('Seeding completed successfully with Personal & Business datasets and tamper-evident audit chains!');
}

if (require.main === module) {
  seedDatabase();
}
