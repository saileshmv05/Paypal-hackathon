import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Decimal from 'decimal.js';

import { db, initDatabase } from './db/database';
import { CURRENCIES, formatCurrencyAmount, quantizeCurrency, splitAmountEqually, toDecimal } from './financial/currency';
import { convertCurrency, DEFAULT_REFERENCE_RATES_EUR_BASE, REFERENCE_RATE_METADATA } from './financial/rates';
import { calculateGroupBalances } from './financial/balances';
import { generateMinTransfersSettlement } from './optimizer/partition';
import { generateMinCostSettlement, enrichPlanWithFees } from './optimizer/costModel';
import { parseFinancialInput } from './ai/service';
import { getPaymentProvider } from './paypal/client';
import { buildReconciliationRecord } from './reconciliation/engine';
import { seedDatabase } from './seed';
import { recordAuditEvent, verifyAuditChain } from './audit/chain';
import { authMiddleware, requireGroupAccess, requireWorkspaceAccess, requireAdmin } from './middleware/auth';
import { CurrencyCode, Expense, GroupMember, SettlementTransfer } from './types';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(authMiddleware);

// Ensure database tables and column migrations exist
initDatabase();

// ----------------------------------------------------------------------
// CONFIGURATION & PROVIDER STATUS
// ----------------------------------------------------------------------
app.get('/api/config', (req, res) => {
  const hasPaypalKeys = !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;
  const isDemoProvider = process.env.ENABLE_DEMO_PROVIDER === 'true';

  res.json({
    currencies: CURRENCIES,
    referenceRates: DEFAULT_REFERENCE_RATES_EUR_BASE,
    referenceMetadata: REFERENCE_RATE_METADATA,
    paypal: {
      isConfigured: hasPaypalKeys,
      mode: isDemoProvider ? 'DEMO_SANDBOX_SIMULATION' : hasPaypalKeys ? 'PAYPAL_SANDBOX' : 'DEMO_SANDBOX_SIMULATION',
      clientId: process.env.PAYPAL_CLIENT_ID || 'demo-client-id-active',
      notice:
        'PayPal Orders v2 merchant Checkout sandbox demonstration. Clearly distinguished from group debt calculations and unobservable bank card fees.',
    },
    ai: {
      isLiveConfigured: hasGeminiKey,
      engine: hasGeminiKey ? 'Gemini 3.8 Flash' : 'Rule-Based Fallback Demo Parser',
    },
  });
});

app.post('/api/demo/reset', requireAdmin, (req, res) => {
  try {
    seedDatabase();
    res.json({ success: true, message: 'Demonstration dataset successfully reset to initial baseline with Personal & Business records.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ----------------------------------------------------------------------
// GROUP MANAGEMENT (PERSONAL SEGMENT)
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

  recordAuditEvent({
    groupId: id,
    entityType: 'GROUP',
    entityId: id,
    eventType: 'GROUP_CREATED',
    actor: 'Admin',
    description: `Created group "${name}" with base currency ${baseCurrency}`,
    metadata: { name, baseCurrency },
  });

  res.json({ id, name, description, baseCurrency, createdAt });
});

app.get('/api/groups/:id', requireGroupAccess, (req, res) => {
  const group: any = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const members = db.prepare('SELECT * FROM group_members WHERE group_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json({ ...group, members });
});

app.post('/api/groups/:id/members', requireGroupAccess, (req, res) => {
  const { name, country, preferredCurrency = 'EUR', email } = req.body;
  if (!name || !country) return res.status(400).json({ error: 'Name and country are required' });

  const id = `member-${uuidv4().substring(0, 8)}`;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO group_members (id, group_id, name, country, preferred_currency, email, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, name, country, preferredCurrency, email || `${name.toLowerCase()}@example.com`, createdAt);

  recordAuditEvent({
    groupId: req.params.id as string,
    entityType: 'MEMBER',
    entityId: id,
    eventType: 'MEMBER_ADDED',
    actor: 'Admin',
    description: `Added member ${name} (${country}, ${preferredCurrency})`,
    metadata: { name, country, preferredCurrency },
  });

  res.json({ id, groupId: req.params.id, name, country, preferredCurrency, email, createdAt });
});

app.get('/api/groups/:id/balances', requireGroupAccess, (req, res) => {
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

  const expensesRaw: any[] = db.prepare(`
    SELECT * FROM expenses
    WHERE group_id = ? AND status = 'APPROVED'
  `).all(req.params.id);

  const expenses: Expense[] = expensesRaw.map((e) => {
    const splitsRaw: any[] = db.prepare('SELECT * FROM expense_splits WHERE expense_id = ?').all(e.id);
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
      splits: splitsRaw.map((s) => ({
        id: s.id,
        expenseId: s.expense_id,
        memberId: s.member_id,
        shareAmount: s.share_amount,
        shareBaseAmount: s.share_base_amount,
      })),
    };
  });

  const balances = calculateGroupBalances({
    members,
    expenses,
    baseCurrency: group.base_currency,
  });
  res.json(balances);
});

// ----------------------------------------------------------------------
// EXPENSE MANAGEMENT & LEDGER
// ----------------------------------------------------------------------
app.get('/api/groups/:id/expenses', requireGroupAccess, (req, res) => {
  const expenses: any[] = db.prepare(`
    SELECT e.*, m.name as payer_name
    FROM expenses e
    JOIN group_members m ON e.payer_id = m.id
    WHERE e.group_id = ?
    ORDER BY e.created_at DESC
  `).all(req.params.id);

  const enriched = expenses.map((e) => {
    const splits: any[] = db.prepare(`
      SELECT s.*, m.name as member_name
      FROM expense_splits s
      JOIN group_members m ON s.member_id = m.id
      WHERE s.expense_id = ?
    `).all(e.id);
    return { ...e, splits };
  });

  res.json(enriched);
});

app.post('/api/groups/:id/expenses', requireGroupAccess, (req, res) => {
  const {
    payerId,
    description,
    category = 'General',
    originalAmount,
    originalCurrency,
    splitMemberIds,
    splitType = 'EQUAL',
    evidenceType = 'MANUAL',
    evidenceRef = '',
  } = req.body;

  if (!payerId || !description || !originalAmount || !originalCurrency || !splitMemberIds || splitMemberIds.length === 0) {
    return res.status(400).json({ error: 'Missing required expense fields' });
  }

  const group: any = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  const id = `exp-${uuidv4().substring(0, 8)}`;
  const createdAt = new Date().toISOString();

  // Convert to base currency with reference rates
  const conversion = convertCurrency(originalAmount, originalCurrency, group.base_currency);
  const baseAmount = conversion.toAmount;

  // Calculate splits with integer minor unit precision
  const splitAmounts = splitAmountEqually(originalAmount, originalCurrency, splitMemberIds.length);

  const insertExpense = db.prepare(`
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

  const transaction = db.transaction(() => {
    insertExpense.run(
      id,
      req.params.id,
      payerId,
      description,
      category,
      originalAmount,
      originalCurrency,
      baseAmount,
      conversion.effectiveRate,
      conversion.rateSource,
      conversion.rateTimestamp,
      conversion.rateDirection,
      splitType,
      evidenceType,
      evidenceRef,
      'APPROVED',
      createdAt,
      createdAt,
      'Manual Approval'
    );

    splitMemberIds.forEach((mId: string, idx: number) => {
      const shareOrig = splitAmounts[idx];
      const shareBaseConv = convertCurrency(shareOrig, originalCurrency, group.base_currency);
      insertSplit.run(uuidv4(), id, mId, shareOrig, shareBaseConv.toAmount);
    });

    recordAuditEvent({
      groupId: req.params.id as string,
      entityType: 'EXPENSE',
      entityId: id,
      eventType: 'EXPENSE_RECORDED',
      actor: 'Admin',
      description: `Added expense "${description}" for ${originalAmount} ${originalCurrency} (Base: ${baseAmount} ${group.base_currency})`,
      metadata: { originalAmount, originalCurrency, baseAmount },
    });
  });

  transaction();

  res.json({
    id,
    groupId: req.params.id,
    payerId,
    description,
    originalAmount,
    originalCurrency,
    baseAmount,
    exchangeRate: conversion.effectiveRate,
    rateSource: conversion.rateSource,
    createdAt,
  });
});

// ----------------------------------------------------------------------
// SETTLEMENT OPTIMIZER
// ----------------------------------------------------------------------
app.get('/api/groups/:id/settlement', requireGroupAccess, (req, res) => {
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

  const expensesRaw: any[] = db.prepare(`
    SELECT * FROM expenses
    WHERE group_id = ? AND status = 'APPROVED'
  `).all(req.params.id);

  const expenses: Expense[] = expensesRaw.map((e) => {
    const splitsRaw: any[] = db.prepare('SELECT * FROM expense_splits WHERE expense_id = ?').all(e.id);
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
      splits: splitsRaw.map((s) => ({
        id: s.id,
        expenseId: s.expense_id,
        memberId: s.member_id,
        shareAmount: s.share_amount,
        shareBaseAmount: s.share_base_amount,
      })),
    };
  });

  const balances = calculateGroupBalances({
    members,
    expenses,
    baseCurrency: group.base_currency,
  });

  const minTransfersPlan = generateMinTransfersSettlement(
    req.params.id as string,
    group.base_currency,
    balances.balances,
    members
  );
  const minCostPlan = generateMinCostSettlement(
    req.params.id as string,
    group.base_currency,
    balances.balances,
    members
  );

  res.json({
    baseCurrency: group.base_currency,
    summary: balances,
    strategies: {
      MIN_TRANSFERS: minTransfersPlan,
      MIN_COST: minCostPlan,
    },
    transparencyNotice:
      'ClearSettle does not assume minimizing transfers minimizes total financial cost. Cross-currency transfer fees and exchange spreads can exceed single-hop savings.',
  });
});

app.post('/api/groups/:id/settlement/plan', requireGroupAccess, (req, res) => {
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

    recordAuditEvent({
      groupId: req.params.id as string,
      entityType: 'SETTLEMENT_PLAN',
      entityId: planId,
      eventType: 'SETTLEMENT_PLAN_GENERATED',
      actor: 'Optimizer',
      description: `Generated ${strategy} settlement plan with ${transfers.length} transfer(s)`,
      metadata: { strategy, totalTransfers: transfers.length },
    });
  });

  transaction();
  res.json({ id: planId, strategy, status: 'SAVED' });
});

// ----------------------------------------------------------------------
// AI EXPENSE INTELLIGENCE & EXTRACTION QUEUE
// ----------------------------------------------------------------------
app.post('/api/groups/:id/ai/extract', requireGroupAccess, async (req, res) => {
  const { sourceType = 'CONVERSATION', input } = req.body;
  if (!input) return res.status(400).json({ error: 'No input text provided' });

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

  // Fetch existing expenses to enable duplicate detection
  const existingExpenses = (db.prepare('SELECT id, original_amount as amount, original_currency as currency, description FROM expenses WHERE group_id = ?').all(req.params.id) as any[]);

  try {
    const parseResult = await parseFinancialInput({
      sourceType,
      input,
      members,
      existingExpenses,
    });

    const insertAI = db.prepare(`
      INSERT INTO ai_extractions (
        id, group_id, classification, confidence_score,
        payer_name, payer_id, involved_members, amount, currency,
        description, date, source_text, split_type, missing_information,
        explanation, is_correction, correction_target_id, is_duplicate, duplicate_of_id, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        item.isCorrection ? 1 : 0,
        item.correctionTargetId || null,
        item.isDuplicate ? 1 : 0,
        item.duplicateOfId || null,
        'PENDING_REVIEW',
        new Date().toISOString()
      );
    }

    recordAuditEvent({
      groupId: req.params.id as string,
      entityType: 'AI_PARSER',
      entityId: 'extraction-job',
      eventType: 'AI_EXTRACTION_PROCESSED',
      actor: 'AI Intelligence',
      description: `Parsed ${sourceType.toLowerCase()} via ${parseResult.engine}: extracted ${parseResult.items.length} item(s)`,
      metadata: { count: parseResult.items.length, engine: parseResult.engine },
    });

    res.json(parseResult);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/groups/:id/ai/items', requireGroupAccess, (req, res) => {
  const items: any[] = db.prepare(`
    SELECT * FROM ai_extractions
    WHERE group_id = ?
    ORDER BY created_at DESC
  `).all(req.params.id);

  const parsed = items.map((i) => ({
    ...i,
    involvedMembers: JSON.parse(i.involved_members || '[]'),
    missingInformation: JSON.parse(i.missing_information || '[]'),
    isCorrection: !!i.is_correction,
    isDuplicate: !!i.is_duplicate,
  }));

  res.json(parsed);
});

app.post('/api/groups/:id/ai/items/:itemId/approve', requireGroupAccess, (req, res) => {
  const item: any = db.prepare('SELECT * FROM ai_extractions WHERE id = ?').get(req.params.itemId);
  if (!item) return res.status(404).json({ error: 'AI Extraction item not found' });

  const { payerId, amount, currency, description, splitMemberIds } = req.body;

  const finalPayerId = payerId || item.payer_id;
  const finalAmount = amount || item.amount;
  const finalCurrency = currency || item.currency || 'EUR';
  const finalDesc = description || item.description;

  if (!finalPayerId || !finalAmount || !finalCurrency) {
    return res.status(400).json({ error: 'Missing critical financial details to approve into ledger' });
  }

  const group: any = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  const conversion = convertCurrency(finalAmount, finalCurrency, group.base_currency);
  const baseAmount = conversion.toAmount;

  const membersRaw: any[] = db.prepare('SELECT id FROM group_members WHERE group_id = ?').all(req.params.id);
  const targetMemberIds: string[] =
    splitMemberIds && splitMemberIds.length > 0 ? splitMemberIds : membersRaw.map((m) => m.id);

  const splitAmounts = splitAmountEqually(finalAmount, finalCurrency, targetMemberIds.length);

  const expId = `exp-${uuidv4().substring(0, 8)}`;
  const now = new Date().toISOString();

  const transaction = db.transaction(() => {
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
      'Group Expense',
      finalAmount,
      finalCurrency,
      baseAmount,
      conversion.effectiveRate,
      conversion.rateSource,
      conversion.rateTimestamp,
      conversion.rateDirection,
      'EQUAL',
      'CONVERSATION',
      `Approved from AI item ${item.id}`,
      'APPROVED',
      now,
      now,
      'Human Reviewer'
    );

    targetMemberIds.forEach((mId, idx) => {
      const shareOrig = splitAmounts[idx];
      const shareBaseConv = convertCurrency(shareOrig, finalCurrency, group.base_currency);
      db.prepare(`
        INSERT INTO expense_splits (id, expense_id, member_id, share_amount, share_base_amount)
        VALUES (?, ?, ?, ?, ?)
      `).run(uuidv4(), expId, mId, shareOrig, shareBaseConv.toAmount);
    });

    db.prepare("UPDATE ai_extractions SET status = 'APPROVED' WHERE id = ?").run(item.id);

    recordAuditEvent({
      groupId: req.params.id as string,
      entityType: 'EXPENSE',
      entityId: expId,
      eventType: 'AI_EXTRACTION_APPROVED',
      actor: 'Human Reviewer',
      description: `Promoted AI item into ledger: "${finalDesc}" (${finalAmount} ${finalCurrency})`,
      metadata: { aiItemId: item.id, finalAmount, finalCurrency },
    });
  });

  transaction();
  res.json({ success: true, expenseId: expId });
});

app.post('/api/groups/:id/ai/items/:itemId/reject', requireGroupAccess, (req, res) => {
  db.prepare("UPDATE ai_extractions SET status = 'REJECTED' WHERE id = ?").run(req.params.itemId);

  recordAuditEvent({
    groupId: req.params.id as string,
    entityType: 'AI_EXTRACTION',
    entityId: req.params.itemId as string,
    eventType: 'AI_EXTRACTION_REJECTED',
    actor: 'Human Reviewer',
    description: `Rejected AI extraction item ${req.params.itemId}`,
  });

  res.json({ success: true });
});

// ----------------------------------------------------------------------
// PAYPAL CHECKOUT LIFECYCLE & SERVER-SIDE AUTHORIZATION
// ----------------------------------------------------------------------
app.post('/api/paypal/create-order', async (req, res) => {
  const { transferId, invoiceId, obligationType = 'SETTLEMENT' } = req.body;

  let targetAmount = '';
  let targetCurrency: CurrencyCode = 'EUR';
  let description = '';
  let entityId = '';
  let entityType = '';
  let groupId = '';

  if (obligationType === 'INVOICE' || invoiceId) {
    const id = invoiceId || transferId;
    const invoice: any = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
    if (!invoice) {
      return res.status(404).json({ error: `Invoice obligation ${id} not found.` });
    }
    if (invoice.status === 'PAID') {
      return res.status(400).json({ error: 'This invoice has already been paid.' });
    }
    targetAmount = invoice.amount;
    targetCurrency = invoice.currency;
    description = `ClearSettle Business Invoice ${invoice.invoice_number}: ${invoice.description}`;
    entityId = invoice.id;
    entityType = 'INVOICE';
    groupId = invoice.workspace_id;
  } else {
    // Authoritative lookup from database (Never trust client amount)
    const transfer: any = db.prepare('SELECT * FROM settlement_transfers WHERE id = ?').get(transferId);
    if (!transfer) {
      return res.status(404).json({ error: `Settlement obligation ${transferId} not found in database.` });
    }
    if (transfer.status === 'COMPLETED') {
      return res.status(400).json({ error: 'This settlement obligation is already marked as completed.' });
    }

    targetAmount = transfer.amount;
    targetCurrency = transfer.currency;
    description = `ClearSettle Settlement: ${transfer.from_member_name} to ${transfer.to_member_name}`;
    entityId = transfer.id;
    entityType = 'SETTLEMENT';

    const plan: any = db.prepare('SELECT group_id FROM settlement_plans WHERE id = ?').get(transfer.plan_id);
    groupId = plan?.group_id || 'group-intl-trip-2026';
  }

  const provider = getPaymentProvider();

  try {
    const host = req.get('host') || 'localhost:5000';
    const protocol = req.protocol || 'http';

    const order = await provider.createTransaction({
      transferId: entityId,
      amount: targetAmount,
      currency: targetCurrency,
      description,
      returnUrl: `${protocol}://${host}/checkout/return?obligationId=${entityId}&obligationType=${entityType}`,
      cancelUrl: `${protocol}://${host}/checkout/cancel?obligationId=${entityId}`,
    });

    // Update entity state machine to INITIATED
    if (entityType === 'SETTLEMENT') {
      db.prepare("UPDATE settlement_transfers SET paypal_order_id = ?, status = 'INITIATED' WHERE id = ?").run(
        order.providerOrderId,
        entityId
      );
    } else {
      db.prepare('UPDATE invoices SET paypal_order_id = ? WHERE id = ?').run(order.providerOrderId, entityId);
    }

    recordAuditEvent({
      groupId,
      entityType: 'PAYMENT_ORDER',
      entityId: order.providerOrderId,
      eventType: 'ORDER_CREATED',
      actor: 'Checkout Gateway',
      description: `Created PayPal order ${order.providerOrderId} for ${targetAmount} ${targetCurrency}`,
      metadata: { orderId: order.providerOrderId, entityId, targetAmount, targetCurrency },
    });

    res.json({
      ...order,
      amount: targetAmount,
      currency: targetCurrency,
      obligationType,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/paypal/capture-order', async (req, res) => {
  const { providerOrderId, transferId, invoiceId, groupId } = req.body;
  if (!providerOrderId) {
    return res.status(400).json({ error: 'Missing providerOrderId' });
  }

  const lookupId = transferId || invoiceId;
  const transfer: any = db.prepare('SELECT * FROM settlement_transfers WHERE id = ?').get(lookupId);
  const invoice: any = db.prepare('SELECT * FROM invoices WHERE id = ?').get(lookupId);

  const group: any = db.prepare('SELECT * FROM groups WHERE id = ?').get(groupId || 'group-intl-trip-2026');
  const baseCurrency = group?.base_currency || 'EUR';

  const provider = getPaymentProvider();

  try {
    // Execute server-side capture verification (NEVER trust client alone)
    const normalizedCapture = await provider.captureTransaction({
      providerOrderId,
      transferId: lookupId || providerOrderId,
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
      : invoice
      ? {
          id: invoice.id,
          planId: invoice.workspace_id,
          fromMemberId: invoice.client_name,
          fromMemberName: invoice.client_name,
          toMemberId: invoice.workspace_id,
          toMemberName: 'Business Workspace',
          amount: invoice.amount,
          currency: invoice.currency,
          targetAmount: invoice.amount,
          targetCurrency: invoice.currency,
          estimatedFee: '0.00',
          status: 'COMPLETED',
        }
      : {
          id: lookupId || 'tx-active',
          planId: 'plan-active',
          fromMemberId: 'payer',
          fromMemberName: 'Payer',
          toMemberId: 'payee',
          toMemberName: 'Payee',
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
      // 1. Update transfer or invoice status
      if (transfer) {
        db.prepare(
          "UPDATE settlement_transfers SET status = 'COMPLETED', paypal_order_id = ?, reconciliation_id = ? WHERE id = ?"
        ).run(providerOrderId, recon.id, transfer.id);
      }
      if (invoice) {
        db.prepare(
          "UPDATE invoices SET status = 'PAID', paid_amount = ?, paypal_order_id = ?, reconciliation_id = ? WHERE id = ?"
        ).run(normalizedCapture.grossAmount, providerOrderId, recon.id, invoice.id);
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
        recon.matchStatus || 'MATCHED',
        JSON.stringify(recon.decisionTrace || {}),
        recon.createdAt
      );

      // 3. Log cryptographic audit event
      recordAuditEvent({
        groupId: groupId || (invoice ? invoice.workspace_id : 'group-intl-trip-2026'),
        entityType: 'CAPTURE',
        entityId: normalizedCapture.providerCaptureId,
        eventType: 'CAPTURE_VERIFIED',
        actor: 'Server Capture Engine',
        description: `Verified PayPal capture ${normalizedCapture.providerCaptureId}. Gross: ${normalizedCapture.grossAmount} ${normalizedCapture.grossCurrency}, Fee: ${normalizedCapture.feeAmount} ${normalizedCapture.feeCurrency}, Net: ${normalizedCapture.netAmount} ${normalizedCapture.netCurrency}`,
        metadata: normalizedCapture.rawSanitizedPayload,
      });
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

// PayPal Return & Cancel Handlers (for real sandbox redirects)
app.get('/checkout/return', (req, res) => {
  const { token, PayerID, obligationId, obligationType } = req.query;
  // Redirect to application UI with payment verification notification
  res.redirect(`/?paypalReturn=true&token=${token || ''}&payerId=${PayerID || ''}&obligationId=${obligationId || ''}&obligationType=${obligationType || ''}`);
});

app.get('/checkout/cancel', (req, res) => {
  res.redirect(`/?paypalCancel=true`);
});

// ----------------------------------------------------------------------
// SMALL BUSINESS WORKSPACE & INVOICING API
// ----------------------------------------------------------------------
app.get('/api/workspaces', (req, res) => {
  const workspaces = db.prepare('SELECT * FROM workspaces ORDER BY created_at DESC').all();
  res.json(workspaces);
});

app.post('/api/workspaces', (req, res) => {
  const { name, type = 'BUSINESS', baseCurrency = 'EUR', ownerName, description } = req.body;
  if (!name || !ownerName) return res.status(400).json({ error: 'Name and owner name are required' });

  const id = `workspace-${uuidv4().substring(0, 8)}`;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO workspaces (id, name, type, base_currency, owner_name, description, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, type, baseCurrency, ownerName, description || '', createdAt);

  recordAuditEvent({
    groupId: id,
    entityType: 'WORKSPACE',
    entityId: id,
    eventType: 'WORKSPACE_CREATED',
    actor: ownerName,
    description: `Created ${type.toLowerCase()} workspace "${name}" with base currency ${baseCurrency}`,
    metadata: { name, type, baseCurrency },
  });

  res.json({ id, name, type, baseCurrency, ownerName, description, createdAt });
});

app.get('/api/workspaces/:id', requireWorkspaceAccess, (req, res) => {
  const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.params.id);
  if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
  res.json(workspace);
});

app.get('/api/workspaces/:id/invoices', requireWorkspaceAccess, (req, res) => {
  const invoices = db.prepare('SELECT * FROM invoices WHERE workspace_id = ? ORDER BY issue_date DESC').all(req.params.id);
  res.json(invoices);
});

app.post('/api/workspaces/:id/invoices', requireWorkspaceAccess, (req, res) => {
  const { invoiceNumber, clientName, clientEmail, description, amount, currency = 'EUR', issueDate, dueDate } = req.body;
  if (!invoiceNumber || !clientName || !amount) {
    return res.status(400).json({ error: 'Invoice number, client name, and amount are required' });
  }

  const workspace: any = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(req.params.id);
  const baseCurrency = workspace?.base_currency || 'EUR';
  const conv = convertCurrency(amount, currency, baseCurrency);

  const id = `inv-${uuidv4().substring(0, 8)}`;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO invoices (
      id, workspace_id, invoice_number, client_name, client_email, description,
      amount, currency, base_amount, issue_date, due_date, status, paid_amount, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.params.id,
    invoiceNumber,
    clientName,
    clientEmail || `${clientName.toLowerCase().replace(/\s+/g, '')}@example.com`,
    description || 'Professional Services',
    amount,
    currency,
    conv.toAmount,
    issueDate || createdAt.split('T')[0],
    dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    'ISSUED',
    '0.00',
    createdAt
  );

  recordAuditEvent({
    groupId: req.params.id as string,
    entityType: 'INVOICE',
    entityId: id,
    eventType: 'INVOICE_ISSUED',
    actor: 'Business User',
    description: `Issued invoice ${invoiceNumber} to ${clientName} for ${amount} ${currency}`,
    metadata: { invoiceNumber, amount, currency },
  });

  res.json({ id, invoiceNumber, clientName, amount, currency, status: 'ISSUED' });
});

app.post('/api/workspaces/:id/invoices/parse', requireWorkspaceAccess, async (req, res) => {
  const { input } = req.body;
  if (!input) return res.status(400).json({ error: 'No invoice document text provided' });

  const result = await parseFinancialInput({
    sourceType: 'INVOICE',
    input,
    members: [],
  });

  res.json(result);
});

app.get('/api/workspaces/:id/clients', requireWorkspaceAccess, (req, res) => {
  const clients = db.prepare('SELECT * FROM clients WHERE workspace_id = ? ORDER BY created_at ASC').all(req.params.id);
  res.json(clients);
});

app.post('/api/workspaces/:id/clients', requireWorkspaceAccess, (req, res) => {
  const { name, email, company, country, preferredCurrency = 'EUR' } = req.body;
  if (!name || !country) return res.status(400).json({ error: 'Name and country are required' });

  const id = `client-${uuidv4().substring(0, 8)}`;
  const createdAt = new Date().toISOString();

  db.prepare(`
    INSERT INTO clients (id, workspace_id, name, email, company, country, preferred_currency, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, name, email || `${name.toLowerCase()}@example.com`, company || '', country, preferredCurrency, createdAt);

  res.json({ id, name, email, company, country, preferredCurrency });
});

// ----------------------------------------------------------------------
// RECONCILIATION DASHBOARD ENDPOINTS
// ----------------------------------------------------------------------
app.get('/api/groups/:id/reconciliations', requireGroupAccess, (req, res) => {
  const records: any[] = db.prepare(`
    SELECT r.*, t.from_member_name, t.to_member_name
    FROM reconciliations r
    LEFT JOIN settlement_transfers t ON r.transfer_id = t.id
    ORDER BY r.created_at DESC
  `).all();

  const parsed = records.map((r) => ({
    ...r,
    decisionTrace: r.decision_trace ? JSON.parse(r.decision_trace) : undefined,
  }));

  res.json(parsed);
});

// ----------------------------------------------------------------------
// AUDIT LOGS & TAMPER-EVIDENT CRYPTOGRAPHIC VERIFICATION
// ----------------------------------------------------------------------
app.get('/api/groups/:id/audit', requireGroupAccess, (req, res) => {
  const events = db.prepare(`
    SELECT * FROM audit_events
    WHERE group_id = ?
    ORDER BY created_at DESC
  `).all(req.params.id);

  res.json(events);
});

app.get('/api/groups/:id/audit/verify', requireGroupAccess, (req, res) => {
  const verification = verifyAuditChain(req.params.id as string);
  res.json(verification);
});

app.get('/api/workspaces/:id/audit/verify', requireWorkspaceAccess, (req, res) => {
  const verification = verifyAuditChain(req.params.id as string);
  res.json(verification);
});

app.get('/api/groups/:id/export/csv', requireGroupAccess, (req, res) => {
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

app.get('/api/groups/:id/export/json', requireGroupAccess, (req, res) => {
  const group = db.prepare('SELECT * FROM groups WHERE id = ?').get(req.params.id);
  const members = db.prepare('SELECT * FROM group_members WHERE group_id = ?').all(req.params.id);
  const expenses = db.prepare('SELECT * FROM expenses WHERE group_id = ?').all(req.params.id);
  const reconciliations = db.prepare('SELECT * FROM reconciliations').all();
  const audit = db.prepare('SELECT * FROM audit_events WHERE group_id = ?').all(req.params.id);
  const verification = verifyAuditChain(req.params.id as string);

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="ClearSettle_Audit_${req.params.id}.json"`);
  res.json({
    exportMetadata: {
      generatedAt: new Date().toISOString(),
      platform: 'ClearSettle Fintech Platform',
      version: '1.1.0',
      cryptographicChainValid: verification.isValid,
      totalAuditedBlocks: verification.totalEvents,
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
  console.log(` Tamper-Evident SHA-256 Audit Chain Active`);
  console.log(` Personal & Small Business Workspaces Enabled`);
  console.log(`=======================================================`);
});
