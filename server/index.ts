import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';

import { db, initDatabase } from './db/database';
import { CURRENCIES, quantizeCurrency, splitAmountEqually, toDecimal } from './financial/currency';
import { convertCurrency, DEFAULT_REFERENCE_RATES_EUR_BASE, REFERENCE_RATE_METADATA } from './financial/rates';
import { calculateGroupBalances } from './financial/balances';
import { generateMinTransfersSettlement } from './optimizer/partition';
import { generateMinCostSettlement, enrichPlanWithFees } from './optimizer/costModel';
import { parseFinancialInput } from './ai/service';
import { getPaymentProvider } from './paypal/client';
import { buildReconciliationRecord } from './reconciliation/engine';
import { seedDatabase } from './seed';
import { CurrencyCode, Expense, GroupMember, SettlementTransfer } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure database tables exist
initDatabase();

// ----------------------------------------------------------------------
// CONFIGURATION & PROVIDER STATUS
// ----------------------------------------------------------------------
app.get('/api/config', (req, res) => {
  const hasPaypalKeys = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;

  res.json({
    currencies: CURRENCIES,
    referenceRates: DEFAULT_REFERENCE_RATES_EUR_BASE,
    referenceMetadata: REFERENCE_RATE_METADATA,
    paypal: {
      isConfigured: hasPaypalKeys,
      mode: hasPaypalKeys ? 'PAYPAL_SANDBOX' : 'DEMO_SANDBOX_SIMULATION',
      clientId: process.env.PAYPAL_CLIENT_ID || 'demo-client-id-active',
      notice:
        'PayPal Orders v2 merchant Checkout sandbox demonstration. Does not represent universal peer-to-peer (P2P) transfers.',
    },
    ai: {
      isLiveConfigured: hasGeminiKey,
      engine: hasGeminiKey ? 'Gemini 3.8 Flash' : 'Rule-Based Fallback Demo Parser',
    },
  });
});

app.post('/api/demo/reset', (req, res) => {
  try {
    seedDatabase();
    res.json({ success: true, message: 'Demonstration dataset successfully reset to initial baseline.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// GROUP MANAGEMENT
// ----------------------------------------------------------------------
app.get('/api/groups', (req, res) => {
  const groups = db.prepare('SELECT * FROM groups ORDER BY created_at DESC').all();
  res.json(groups);
});

app.post('/api/groups', (req, res) => {
  const { name, description, baseCurrency = 'EUR' } = req.body;
  if (!name) return res.status(400).json({ error: 'Group name is required' });

  const id = `group-${uuidv4().substring(0, 8)}`;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO groups (id, name, description, base_currency, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, description || '', baseCurrency, createdAt);

  db.prepare(`
    INSERT INTO audit_events (id, group_id, entity_type, entity_id, event_type, actor, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), id, 'GROUP', id, 'GROUP_CREATED', 'Admin', `Created group "${name}" with base currency ${baseCurrency}`, createdAt);

  res.json({ id, name, description, baseCurrency, createdAt });
});

app.get('/api/groups/:id', (req, res) => {
  const group: any = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = db.prepare('SELECT * FROM group_members WHERE group_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json({ ...group, members });
});

app.post('/api/groups/:id/members', (req, res) => {
  const { name, country, preferredCurrency = 'EUR', email } = req.body;
  if (!name || !country) return res.status(400).json({ error: 'Name and country are required' });

  const id = `member-${uuidv4().substring(0, 8)}`;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO group_members (id, group_id, name, country, preferred_currency, email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, name, country, preferredCurrency, email || `${name.toLowerCase()}@example.com`, createdAt);

  db.prepare(`
    INSERT INTO audit_events (id, group_id, entity_type, entity_id, event_type, actor, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), req.params.id, 'MEMBER', id, 'MEMBER_ADDED', 'Admin', `Added member ${name} (${country}, ${preferredCurrency})`, createdAt);

  res.json({ id, groupId: req.params.id, name, country, preferredCurrency, email, createdAt });
});

app.get('/api/groups/:id/balances', (req, res) => {
  const group: any = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const membersRaw: any[] = db.prepare('SELECT * FROM group_members WHERE group_id = ?').all(req.params.id);
  const members: GroupMember[] = membersRaw.map((m) => ({
    id: m.id,
    groupId: m.group_id,
    name: m.name,
    country: m.country,
    preferredCurrency: m.preferred_currency,
    email: m.email,
    createdAt: m.created_at,
  }));

  const expensesRaw: any[] = db.prepare("SELECT * FROM expenses WHERE group_id = ? AND status = 'APPROVED'").all(req.params.id);
  const splitsRaw: any[] = db.prepare(`
    SELECT s.* FROM expense_splits s
    JOIN expenses e ON s.expense_id = e.id
    WHERE e.group_id = ? AND e.status = 'APPROVED'
  `).all(req.params.id);

  const expenses: Expense[] = expensesRaw.map((e) => {
    const splits = splitsRaw
      .filter((s) => s.expense_id === e.id)
      .map((s) => ({
        id: s.id,
        expenseId: s.expense_id,
        memberId: s.member_id,
        shareAmount: s.share_amount,
        shareBaseAmount: s.share_base_amount,
      }));
    return {
      id: e.id,
      groupId: e.group_id,
      payerId: e.payer_id,
      description: e.description,
      category: e.category,
      originalAmount: e.original_amount,
      originalCurrency: e.original_currency,
      baseAmount: e.base_amount,
      exchangeRate: e.exchange_rate,
      rateSource: e.rate_source,
      rateTimestamp: e.rate_timestamp,
      rateDirection: e.rate_direction,
      splitType: e.split_type,
      evidenceType: e.evidence_type,
      evidenceRef: e.evidence_ref,
      status: e.status,
      createdAt: e.created_at,
      splits,
    };
  });

  const transfersRaw: any[] = db.prepare(`
    SELECT t.* FROM settlement_transfers t
    JOIN settlement_plans p ON t.plan_id = p.id
    WHERE p.group_id = ? AND t.status IN ('COMPLETED', 'SETTLED_EXTERNALLY')
  `).all(req.params.id);

  const transfers: SettlementTransfer[] = transfersRaw.map((t) => ({
    id: t.id,
    planId: t.plan_id,
    fromMemberId: t.from_member_id,
    fromMemberName: t.from_member_name,
    toMemberId: t.to_member_id,
    toMemberName: t.to_member_name,
    amount: t.amount,
    currency: t.currency,
    targetAmount: t.target_amount,
    targetCurrency: t.target_currency,
    estimatedFee: t.estimated_fee,
    status: t.status,
  }));

  const summary = calculateGroupBalances({
    baseCurrency: group.base_currency,
    members,
    expenses,
    transfers,
  });

  res.json(summary);
});

// ----------------------------------------------------------------------
// EXPENSES & FINANCIAL LEDGER
// ----------------------------------------------------------------------
app.get('/api/groups/:id/expenses', (req, res) => {
  const expenses: any[] = db.prepare(`
    SELECT e.*, m.name as payer_name
    FROM expenses e
    JOIN group_members m ON e.payer_id = m.id
    WHERE e.group_id = ?
    ORDER BY e.created_at DESC
  `).all(req.params.id);

  const splits: any[] = db.prepare(`
    SELECT s.*, m.name as member_name
    FROM expense_splits s
    JOIN expenses e ON s.expense_id = e.id
    JOIN group_members m ON s.member_id = m.id
    WHERE e.group_id = ?
  `).all(req.params.id);

  const result = expenses.map((e) => ({
    ...e,
    splits: splits.filter((s) => s.expense_id === e.id),
  }));

  res.json(result);
});

app.post('/api/groups/:id/expenses', (req, res) => {
  const {
    payerId,
    description,
    category = 'General',
    originalAmount,
    originalCurrency,
    splitMemberIds,
    evidenceType = 'MANUAL',
    evidenceRef,
  } = req.body;

  if (!payerId || !description || !originalAmount || !originalCurrency || !splitMemberIds || splitMemberIds.length === 0) {
    return res.status(400).json({ error: 'Missing required expense fields' });
  }

  const group: any = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const id = `exp-${uuidv4().substring(0, 8)}`;
  const createdAt = new Date().toISOString();

  // Convert to group base currency with exact decimal arithmetic
  const conversion = convertCurrency(originalAmount, originalCurrency, group.base_currency);
  const baseTotal = conversion.toAmount;

  // Split equally with ZERO lost cents
  const origShares = splitAmountEqually(originalAmount, originalCurrency, splitMemberIds.length);
  const baseShares = splitAmountEqually(baseTotal, group.base_currency, splitMemberIds.length);

  const insertExp = db.prepare(`
    INSERT INTO expenses (
      id, group_id, payer_id, description, category,
      original_amount, original_currency, base_amount,
      exchange_rate, rate_source, rate_timestamp, rate_direction,
      split_type, evidence_type, evidence_ref, status,
      created_at, approved_at, approved_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertSplit = db.prepare(`
    INSERT INTO expense_splits (id, expense_id, member_id, share_amount, share_base_amount)
    VALUES (?, ?, ?, ?, ?)
  `);

  const insertAudit = db.prepare(`
    INSERT INTO audit_events (id, group_id, entity_type, entity_id, event_type, actor, description, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertExp.run(
      id,
      req.params.id,
      payerId,
      description,
      category,
      originalAmount,
      originalCurrency,
      baseTotal,
      conversion.effectiveRate,
      conversion.rateSource,
      conversion.rateTimestamp,
      conversion.rateDirection,
      'EQUAL',
      evidenceType,
      evidenceRef || null,
      'APPROVED',
      createdAt,
      createdAt,
      'User'
    );

    for (let i = 0; i < splitMemberIds.length; i++) {
      insertSplit.run(uuidv4(), id, splitMemberIds[i], origShares[i], baseShares[i]);
    }

    insertAudit.run(
      uuidv4(),
      req.params.id,
      'EXPENSE',
      id,
      'EXPENSE_CREATED',
      'User',
      `Created expense "${description}" for ${originalAmount} ${originalCurrency} (Base: ${baseTotal} ${group.base_currency})`,
      JSON.stringify({ originalAmount, originalCurrency, baseTotal, payerId, splitsCount: splitMemberIds.length }),
      createdAt
    );
  });

  transaction();

  res.json({ id, description, originalAmount, originalCurrency, baseAmount: baseTotal, createdAt });
});

// ----------------------------------------------------------------------
// SETTLEMENT OPTIMIZER
// ----------------------------------------------------------------------
app.get('/api/groups/:id/settlement', (req, res) => {
  const group: any = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const membersRaw: any[] = db.prepare('SELECT * FROM group_members WHERE group_id = ?').all(req.params.id);
  const members: GroupMember[] = membersRaw.map((m) => ({
    id: m.id,
    groupId: m.group_id,
    name: m.name,
    country: m.country,
    preferredCurrency: m.preferred_currency,
    email: m.email,
    createdAt: m.created_at,
  }));

  const expensesRaw: any[] = db.prepare("SELECT * FROM expenses WHERE group_id = ? AND status = 'APPROVED'").all(req.params.id);
  const splitsRaw: any[] = db.prepare(`
    SELECT s.* FROM expense_splits s
    JOIN expenses e ON s.expense_id = e.id
    WHERE e.group_id = ? AND e.status = 'APPROVED'
  `).all(req.params.id);

  const expenses: Expense[] = expensesRaw.map((e) => ({
    id: e.id,
    groupId: e.group_id,
    payerId: e.payer_id,
    description: e.description,
    category: e.category,
    originalAmount: e.original_amount,
    originalCurrency: e.original_currency,
    baseAmount: e.base_amount,
    exchangeRate: e.exchange_rate,
    rateSource: e.rate_source,
    rateTimestamp: e.rate_timestamp,
    rateDirection: e.rate_direction,
    splitType: e.split_type,
    evidenceType: e.evidence_type,
    status: e.status,
    createdAt: e.created_at,
    splits: splitsRaw
      .filter((s) => s.expense_id === e.id)
      .map((s) => ({
        id: s.id,
        expenseId: s.expense_id,
        memberId: s.member_id,
        shareAmount: s.share_amount,
        shareBaseAmount: s.share_base_amount,
      })),
  }));

  const transfersRaw: any[] = db.prepare(`
    SELECT t.* FROM settlement_transfers t
    JOIN settlement_plans p ON t.plan_id = p.id
    WHERE p.group_id = ? AND t.status IN ('COMPLETED', 'SETTLED_EXTERNALLY')
  `).all(req.params.id);

  const transfers: SettlementTransfer[] = transfersRaw.map((t) => ({
    id: t.id,
    planId: t.plan_id,
    fromMemberId: t.from_member_id,
    fromMemberName: t.from_member_name,
    toMemberId: t.to_member_id,
    toMemberName: t.to_member_name,
    amount: t.amount,
    currency: t.currency,
    targetAmount: t.target_amount,
    targetCurrency: t.target_currency,
    estimatedFee: t.estimated_fee,
    status: t.status,
  }));

  const summary = calculateGroupBalances({
    baseCurrency: group.base_currency,
    members,
    expenses,
    transfers,
  });

  // Generate both strategies
  const minTransfersRaw = generateMinTransfersSettlement(req.params.id, group.base_currency, summary.balances, members);
  const minTransfersPlan = enrichPlanWithFees(minTransfersRaw, group.base_currency, members);

  const minCostPlan = generateMinCostSettlement(req.params.id, group.base_currency, summary.balances, members);

  res.json({
    baseCurrency: group.base_currency,
    summary,
    strategies: {
      MIN_TRANSFERS: minTransfersPlan,
      MIN_COST: minCostPlan,
    },
    transparencyNotice:
      'Settlement calculations model estimated retail foreign exchange spreads (2.5%) and fixed provider processing fees. Minimum transfers minimizes operational payment friction; Minimum cost prioritizes domestic currency pairings to reduce cross-border conversion charges.',
  });
});

app.post('/api/groups/:id/settlement/plan', (req, res) => {
  const { strategy, transfers, totalDebtVolumeBase, estimatedFeeCostBase, explanation } = req.body;
  if (!strategy || !transfers) return res.status(400).json({ error: 'Missing strategy or transfers' });

  const planId = `plan-${uuidv4().substring(0, 8)}`;
  const createdAt = new Date().toISOString();

  const insertPlan = db.prepare(`
    INSERT INTO settlement_plans (id, group_id, strategy, total_debt_volume_base, estimated_fee_cost_base, zero_sum_subsets_count, explanation, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertTransfer = db.prepare(`
    INSERT INTO settlement_transfers (
      id, plan_id, from_member_id, from_member_name,
      to_member_id, to_member_name, amount, currency,
      target_amount, target_currency, estimated_fee, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const transaction = db.transaction(() => {
    insertPlan.run(
      planId,
      req.params.id,
      strategy,
      totalDebtVolumeBase || '0.00',
      estimatedFeeCostBase || '0.00',
      1,
      explanation || '',
      createdAt
    );

    for (const t of transfers) {
      insertTransfer.run(
        t.id || uuidv4(),
        planId,
        t.fromMemberId,
        t.fromMemberName,
        t.toMemberId,
        t.toMemberName,
        t.amount,
        t.currency,
        t.targetAmount,
        t.targetCurrency,
        t.estimatedFee || '0.00',
        t.status || 'PENDING'
      );
    }

    db.prepare(`
      INSERT INTO audit_events (id, group_id, entity_type, entity_id, event_type, actor, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      req.params.id,
      'SETTLEMENT_PLAN',
      planId,
      'SETTLEMENT_PLAN_GENERATED',
      'Optimizer',
      `Generated ${strategy} settlement plan with ${transfers.length} transfer(s)`,
      createdAt
    );
  });

  transaction();

  res.json({ planId, strategy, status: 'SAVED' });
});

// ----------------------------------------------------------------------
// AI EXPENSE INTELLIGENCE & VERIFICATION QUEUE
// ----------------------------------------------------------------------
app.post('/api/groups/:id/ai/extract', async (req, res) => {
  const { input, sourceType = 'CONVERSATION' } = req.body;
  if (!input) return res.status(400).json({ error: 'Input text is required for AI extraction' });

  const membersRaw: any[] = db.prepare('SELECT * FROM group_members WHERE group_id = ?').all(req.params.id);
  const members: GroupMember[] = membersRaw.map((m) => ({
    id: m.id,
    groupId: m.group_id,
    name: m.name,
    country: m.country,
    preferredCurrency: m.preferred_currency,
    email: m.email,
    createdAt: m.created_at,
  }));

  try {
    const parseResult = await parseFinancialInput({
      sourceType,
      input,
      members,
    });

    // Store in AI extraction queue for human review
    const insertAI = db.prepare(`
      INSERT INTO ai_extractions (
        id, group_id, classification, confidence_score,
        payer_name, payer_id, involved_members, amount, currency,
        description, date, source_text, split_type, missing_information,
        explanation, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of parseResult.items) {
      insertAI.run(
        item.id,
        req.params.id,
        item.classification,
        item.confidenceScore,
        item.payerName || null,
        item.payerId || null,
        JSON.stringify(item.involvedMembers),
        item.amount || null,
        item.currency || null,
        item.description,
        item.date || null,
        item.sourceText,
        item.splitType,
        JSON.stringify(item.missingInformation),
        item.explanation,
        'PENDING_REVIEW',
        new Date().toISOString()
      );
    }

    db.prepare(`
      INSERT INTO audit_events (id, group_id, entity_type, entity_id, event_type, actor, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      req.params.id,
      'AI_PARSER',
      'extraction-job',
      'AI_EXTRACTION_PROCESSED',
      'AI Intelligence',
      `Parsed ${sourceType.toLowerCase()} via ${parseResult.engine}: extracted ${parseResult.items.length} item(s)`,
      new Date().toISOString()
    );

    res.json(parseResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/groups/:id/ai/items', (req, res) => {
  const items: any[] = db.prepare(`
    SELECT * FROM ai_extractions
    WHERE group_id = ?
    ORDER BY created_at DESC
  `).all(req.params.id);

  const parsed = items.map((i) => ({
    ...i,
    involvedMembers: JSON.parse(i.involved_members || '[]'),
    missingInformation: JSON.parse(i.missing_information || '[]'),
  }));

  res.json(parsed);
});

app.post('/api/groups/:id/ai/items/:itemId/approve', (req, res) => {
  const item: any = db.prepare('SELECT * FROM ai_extractions WHERE id = ?').get(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'AI Extraction item not found' });

  const { payerId, amount, currency, description, splitMemberIds } = req.body;

  const finalPayerId = payerId || item.payer_id;
  const finalAmount = amount || item.amount;
  const finalCurrency = currency || item.currency || 'EUR';
  const finalDesc = description || item.description;

  if (!finalPayerId || !finalAmount) {
    return res.status(400).json({
      error: 'Cannot approve expense without confirmed payer and amount. Please edit or provide missing details.',
    });
  }

  const group: any = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  const members = db.prepare('SELECT id FROM group_members WHERE group_id = ?').all(req.params.id);
  const participants = splitMemberIds && splitMemberIds.length > 0 ? splitMemberIds : members.map((m: any) => m.id);

  const createdAt = new Date().toISOString();
  const conversion = convertCurrency(finalAmount, finalCurrency, group.base_currency);
  const baseTotal = conversion.toAmount;

  const origShares = splitAmountEqually(finalAmount, finalCurrency, participants.length);
  const baseShares = splitAmountEqually(baseTotal, group.base_currency, participants.length);

  const expId = `exp-approved-${uuidv4().substring(0, 8)}`;

  const transaction = db.transaction(() => {
    // 1. Insert into approved expenses
    db.prepare(`
      INSERT INTO expenses (
        id, group_id, payer_id, description, category,
        original_amount, original_currency, base_amount,
        exchange_rate, rate_source, rate_timestamp, rate_direction,
        split_type, evidence_type, evidence_ref, status,
        created_at, approved_at, approved_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      expId,
      req.params.id,
      finalPayerId,
      finalDesc,
      'AI Verified',
      finalAmount,
      finalCurrency,
      baseTotal,
      conversion.effectiveRate,
      conversion.rateSource,
      conversion.rateTimestamp,
      conversion.rateDirection,
      'EQUAL',
      'CONVERSATION',
      item.source_text,
      'APPROVED',
      createdAt,
      createdAt,
      'Human Reviewer'
    );

    // 2. Insert splits
    const insertSplit = db.prepare(`
      INSERT INTO expense_splits (id, expense_id, member_id, share_amount, share_base_amount)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (let i = 0; i < participants.length; i++) {
      insertSplit.run(uuidv4(), expId, participants[i], origShares[i], baseShares[i]);
    }

    // 3. Mark AI item as approved
    db.prepare("UPDATE ai_extractions SET status = 'APPROVED' WHERE id = ?").run(req.params.itemId);

    // 4. Audit trail
    db.prepare(`
      INSERT INTO audit_events (id, group_id, entity_type, entity_id, event_type, actor, description, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuidv4(),
      req.params.id,
      'AI_ITEM',
      req.params.itemId,
      'AI_ITEM_APPROVED',
      'Human Reviewer',
      `Approved AI extraction into financial ledger: "${finalDesc}" (${finalAmount} ${finalCurrency})`,
      JSON.stringify({ expenseId: expId, originalSource: item.source_text, confidence: item.confidence_score }),
      createdAt
    );
  });

  transaction();

  res.json({ success: true, expenseId: expId, message: 'Expense verified and committed to ledger.' });
});

app.post('/api/groups/:id/ai/items/:itemId/reject', (req, res) => {
  db.prepare("UPDATE ai_extractions SET status = 'REJECTED' WHERE id = ?").run(req.params.itemId);

  db.prepare(`
    INSERT INTO audit_events (id, group_id, entity_type, entity_id, event_type, actor, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuidv4(),
    req.params.id,
    'AI_ITEM',
    req.params.itemId,
    'AI_ITEM_REJECTED',
    'Human Reviewer',
    'Rejected AI extraction item from entering financial ledger',
    new Date().toISOString()
  );

  res.json({ success: true, message: 'Item rejected.' });
});

// ----------------------------------------------------------------------
// PAYPAL CHECKOUT INTEGRATION & RECONCILIATION
// ----------------------------------------------------------------------
app.post('/api/paypal/create-order', async (req, res) => {
  const { transferId, amount, currency, description } = req.body;
  if (!transferId || !amount || !currency) {
    return res.status(400).json({ error: 'Missing required order parameters' });
  }

  const provider = getPaymentProvider();

  try {
    const order = await provider.createTransaction({
      transferId,
      amount,
      currency,
      description: description || `ClearSettle Settlement #${transferId}`,
    });

    res.json(order);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/paypal/capture-order', async (req, res) => {
  const { providerOrderId, transferId, groupId } = req.body;
  if (!providerOrderId || !transferId) {
    return res.status(400).json({ error: 'Missing providerOrderId or transferId' });
  }

  const transfer: any = db.prepare('SELECT * FROM settlement_transfers WHERE id = ?').get(transferId);
  const group: any = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId || 'group-intl-trip-2026');
  const baseCurrency = group?.base_currency || 'EUR';

  const provider = getPaymentProvider();

  try {
    // Execute server-side capture verification (NEVER trust client alone)
    const normalizedCapture = await provider.captureTransaction({
      providerOrderId,
      transferId,
    });

    if (normalizedCapture.status !== 'COMPLETED') {
      return res.status(400).json({
        error: 'PayPal capture failed or is pending verification.',
        capture: normalizedCapture,
      });
    }

    // Build reconciliation record
    const mockTransfer: SettlementTransfer = transfer
      ? {
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
          estimatedFee: transfer.estimated_fee,
          status: 'COMPLETED',
        }
      : {
          id: transferId,
          planId: 'plan-active',
          fromMemberId: 'member-sam-usd',
          fromMemberName: 'Sam',
          toMemberId: 'member-alex-eur',
          toMemberName: 'Alex',
          amount: normalizedCapture.grossAmount,
          currency: normalizedCapture.grossCurrency,
          targetAmount: normalizedCapture.grossAmount,
          targetCurrency: normalizedCapture.grossCurrency,
          estimatedFee: normalizedCapture.feeAmount,
          status: 'COMPLETED',
        };

    const quoteResponse = await provider.getQuote({
      fromAmount: mockTransfer.amount,
      fromCurrency: mockTransfer.currency,
      toCurrency: mockTransfer.targetCurrency,
    });

    const recon = buildReconciliationRecord({
      transfer: mockTransfer,
      provider: provider.name as any,
      quote: quoteResponse,
      capture: normalizedCapture,
      baseCurrency,
    });

    // Save capture & reconciliation safely in transaction
    const transaction = db.transaction(() => {
      // 1. Update transfer status
      if (transfer) {
        db.prepare(
          "UPDATE settlement_transfers SET status = 'COMPLETED', paypal_order_id = ?, reconciliation_id = ? WHERE id = ?"
        ).run(providerOrderId, recon.id, transferId);
      }

      // 2. Insert reconciliation record
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
        recon.id,
        recon.transferId,
        recon.transactionId,
        recon.provider,
        recon.status,
        recon.captureProvenance,
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
        recon.createdAt
      );

      // 3. Log audit event
      db.prepare(`
        INSERT INTO audit_events (id, group_id, entity_type, entity_id, event_type, actor, description, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        groupId || 'group-intl-trip-2026',
        'CAPTURE',
        normalizedCapture.providerCaptureId,
        'CAPTURE_VERIFIED',
        'Server Capture Engine',
        `Verified PayPal capture ${normalizedCapture.providerCaptureId}. Gross: ${normalizedCapture.grossAmount} ${normalizedCapture.grossCurrency}, Fee: ${normalizedCapture.feeAmount} ${normalizedCapture.feeCurrency}, Net: ${normalizedCapture.netAmount} ${normalizedCapture.netCurrency}`,
        JSON.stringify(normalizedCapture.rawSanitizedPayload),
        new Date().toISOString()
      );
    });

    transaction();

    res.json({
      success: true,
      capture: normalizedCapture,
      reconciliation: recon,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// RECONCILIATION DASHBOARD ENDPOINTS
// ----------------------------------------------------------------------
app.get('/api/groups/:id/reconciliations', (req, res) => {
  const records = db.prepare(`
    SELECT r.*, t.from_member_name, t.to_member_name
    FROM reconciliations r
    LEFT JOIN settlement_transfers t ON r.transfer_id = t.id
    ORDER BY r.created_at DESC
  `).all();

  res.json(records);
});

// ----------------------------------------------------------------------
// AUDIT LOGS & REPORTS
// ----------------------------------------------------------------------
app.get('/api/groups/:id/audit', (req, res) => {
  const events = db.prepare(`
    SELECT * FROM audit_events
    WHERE group_id = ?
    ORDER BY created_at DESC
  `).all(req.params.id);

  res.json(events);
});

app.get('/api/groups/:id/export/csv', (req, res) => {
  const expenses: any[] = db.prepare(`
    SELECT e.*, m.name as payer_name
    FROM expenses e
    JOIN group_members m ON e.payer_id = m.id
    WHERE e.group_id = ?
    ORDER BY e.created_at ASC
  `).all(req.params.id);

  const headers = [
    'Expense ID',
    'Date',
    'Description',
    'Category',
    'Payer',
    'Original Amount',
    'Original Currency',
    'Base Amount (EUR)',
    'Exchange Rate',
    'Rate Source',
    'Rate Timestamp',
    'Status',
    'Evidence Ref',
  ];

  const rows = expenses.map((e) => [
    e.id,
    e.created_at.split('T')[0],
    `"${e.description.replace(/"/g, '""')}"`,
    e.category,
    e.payer_name,
    e.original_amount,
    e.original_currency,
    e.base_amount,
    e.exchange_rate,
    e.rate_source,
    e.rate_timestamp,
    e.status,
    e.evidence_ref || '',
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="ClearSettle_Ledger_${req.params.id}.csv"`);
  res.send(csvContent);
});

app.get('/api/evidence/summary', (req, res) => {
  const summaryCsvPath = path.resolve(__dirname, '../evidence/summary.csv');
  if (!fs.existsSync(summaryCsvPath)) {
    return res.json({ exists: false, records: [] });
  }

  const raw = fs.readFileSync(summaryCsvPath, 'utf8');
  const lines = raw.split('\n').filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    return res.json({ exists: true, records: [] });
  }

  const headers = lines[0].split(',');
  const records = lines.slice(1).map((line) => {
    const cols = line.split(',');
    return {
      orderId: cols[0],
      captureId: cols[1],
      timestamp: cols[2],
      pair: cols[3],
      orderCurrency: cols[4],
      grossAmount: cols[5],
      paypalFee: cols[6],
      netAmount: cols[7],
      receivableCurrency: cols[8],
      receivableAmount: cols[9],
      paypalExchangeRate: cols[10],
      ecbReferenceRate: cols[11],
      effectiveSpreadVsECB: cols[12],
      rateDirection: cols[13],
      explanation: cols[14]?.replace(/^"|"$/g, '') || '',
      provenance: 'PAYPAL-CAPTURE' as const,
    };
  });

  res.json({ exists: true, records });
});

app.get('/api/groups/:id/export/json', (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  const members = db.prepare('SELECT * FROM group_members WHERE group_id = ?').all(req.params.id);
  const expenses = db.prepare('SELECT * FROM expenses WHERE group_id = ?').all(req.params.id);
  const reconciliations = db.prepare('SELECT * FROM reconciliations').all();
  const audit = db.prepare('SELECT * FROM audit_events WHERE group_id = ?').all(req.params.id);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="ClearSettle_Audit_${req.params.id}.json"`);
  res.json({
    exportMetadata: {
      generatedAt: new Date().toISOString(),
      platform: 'ClearSettle Fintech Platform',
      version: '1.0.0',
    },
    group,
    members,
    expenses,
    reconciliations,
    auditTrail: audit,
  });
});

// Serve frontend build in production / unified preview
const clientDistPath = path.resolve(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('{*path}', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  const indexFile = path.join(clientDistPath, 'index.html');
  if (fs.existsSync(indexFile)) {
    return res.sendFile(indexFile);
  }
  next();
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` ClearSettle Backend API running at http://localhost:${PORT}`);
  console.log(` Multi-currency Ledger & PayPal Sandbox Ready`);
  console.log(`=======================================================`);
});
