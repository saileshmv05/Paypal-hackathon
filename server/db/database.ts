import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(__dirname, '../../clearsettle.db');

export const db = new Database(dbPath);

// Enable foreign keys and WAL mode for high performance & reliability
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export function initDatabase() {
  const schema = `
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      base_currency TEXT NOT NULL DEFAULT 'EUR',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      name TEXT NOT NULL,
      country TEXT NOT NULL,
      preferred_currency TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      payer_id TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'General',
      original_amount TEXT NOT NULL,
      original_currency TEXT NOT NULL,
      base_amount TEXT NOT NULL,
      exchange_rate TEXT NOT NULL,
      rate_source TEXT NOT NULL,
      rate_timestamp TEXT NOT NULL,
      rate_direction TEXT NOT NULL,
      split_type TEXT NOT NULL DEFAULT 'EQUAL',
      evidence_type TEXT NOT NULL DEFAULT 'MANUAL',
      evidence_ref TEXT,
      status TEXT NOT NULL DEFAULT 'APPROVED',
      created_at TEXT NOT NULL,
      approved_at TEXT,
      approved_by TEXT,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (payer_id) REFERENCES group_members(id)
    );

    CREATE TABLE IF NOT EXISTS expense_splits (
      id TEXT PRIMARY KEY,
      expense_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      share_amount TEXT NOT NULL,
      share_base_amount TEXT NOT NULL,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE,
      FOREIGN KEY (member_id) REFERENCES group_members(id)
    );

    CREATE TABLE IF NOT EXISTS settlement_plans (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      strategy TEXT NOT NULL,
      total_debt_volume_base TEXT NOT NULL,
      estimated_fee_cost_base TEXT NOT NULL,
      zero_sum_subsets_count INTEGER DEFAULT 1,
      explanation TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settlement_transfers (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL,
      from_member_id TEXT NOT NULL,
      from_member_name TEXT NOT NULL,
      to_member_id TEXT NOT NULL,
      to_member_name TEXT NOT NULL,
      amount TEXT NOT NULL,
      currency TEXT NOT NULL,
      target_amount TEXT NOT NULL,
      target_currency TEXT NOT NULL,
      estimated_fee TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      paypal_order_id TEXT,
      reconciliation_id TEXT,
      FOREIGN KEY (plan_id) REFERENCES settlement_plans(id) ON DELETE CASCADE,
      FOREIGN KEY (from_member_id) REFERENCES group_members(id),
      FOREIGN KEY (to_member_id) REFERENCES group_members(id)
    );

    CREATE TABLE IF NOT EXISTS reconciliations (
      id TEXT PRIMARY KEY,
      transfer_id TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL,
      capture_provenance TEXT NOT NULL DEFAULT 'SIMULATED',
      ledger_original_amount TEXT NOT NULL,
      ledger_original_currency TEXT NOT NULL,
      ledger_reference_rate TEXT NOT NULL,
      ledger_rate_source TEXT NOT NULL,
      ledger_rate_timestamp TEXT NOT NULL,
      ledger_converted_base_amount TEXT NOT NULL,
      ledger_base_currency TEXT NOT NULL,
      quote_amount TEXT,
      quote_currency TEXT,
      quote_fx_rate TEXT,
      quote_id TEXT,
      quote_expires_at TEXT,
      quote_status TEXT,
      capture_id TEXT,
      capture_gross_amount TEXT,
      capture_gross_currency TEXT,
      capture_fee_amount TEXT,
      capture_fee_currency TEXT,
      capture_net_amount TEXT,
      capture_net_currency TEXT,
      capture_effective_rate TEXT,
      capture_receivable_amount TEXT,
      capture_receivable_currency TEXT,
      capture_timestamp TEXT,
      diff_ledger_vs_capture_gross TEXT,
      diff_quote_vs_capture_gross TEXT,
      observed_provider_fee TEXT,
      unobservable_charges_estimate TEXT,
      explanation TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_events (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      actor TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata TEXT,
      prev_hash TEXT NOT NULL DEFAULT '',
      hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_extractions (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      classification TEXT NOT NULL,
      confidence_score REAL NOT NULL,
      payer_name TEXT,
      payer_id TEXT,
      involved_members TEXT NOT NULL,
      amount TEXT,
      currency TEXT,
      description TEXT NOT NULL,
      date TEXT,
      source_text TEXT NOT NULL,
      split_type TEXT NOT NULL DEFAULT 'EQUAL',
      missing_information TEXT,
      explanation TEXT NOT NULL,
      is_correction INTEGER NOT NULL DEFAULT 0,
      correction_target_id TEXT,
      is_duplicate INTEGER NOT NULL DEFAULT 0,
      duplicate_of_id TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
      created_at TEXT NOT NULL
    );

    -- Small Business Workspace & Invoicing Tables
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'PERSONAL',
      base_currency TEXT NOT NULL DEFAULT 'EUR',
      owner_name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      invoice_number TEXT NOT NULL,
      client_name TEXT NOT NULL,
      client_email TEXT NOT NULL,
      description TEXT NOT NULL,
      amount TEXT NOT NULL,
      currency TEXT NOT NULL,
      base_amount TEXT NOT NULL,
      issue_date TEXT NOT NULL,
      due_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ISSUED',
      paid_amount TEXT NOT NULL DEFAULT '0.00',
      paypal_order_id TEXT,
      reconciliation_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      company TEXT,
      country TEXT NOT NULL,
      preferred_currency TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'MEMBER',
      created_at TEXT NOT NULL
    );
  `;

  db.exec(schema);

  // Column migrations for existing databases
  try {
    const groupCols = (db.prepare("PRAGMA table_info('groups')").all() as any[]).map((c) => c.name);
    if (!groupCols.includes('created_by')) {
      db.prepare("ALTER TABLE groups ADD COLUMN created_by TEXT").run();
    }

    const workspaceCols = (db.prepare("PRAGMA table_info('workspaces')").all() as any[]).map((c) => c.name);
    if (!workspaceCols.includes('owner_id')) {
      db.prepare("ALTER TABLE workspaces ADD COLUMN owner_id TEXT").run();
    }

    const reconCols = (db.prepare("PRAGMA table_info('reconciliations')").all() as any[]).map((c) => c.name);
    if (!reconCols.includes('capture_provenance')) {
      db.prepare("ALTER TABLE reconciliations ADD COLUMN capture_provenance TEXT NOT NULL DEFAULT 'SIMULATED'").run();
    }
    if (!reconCols.includes('match_status')) {
      db.prepare("ALTER TABLE reconciliations ADD COLUMN match_status TEXT NOT NULL DEFAULT 'MATCHED'").run();
    }
    if (!reconCols.includes('decision_trace')) {
      db.prepare("ALTER TABLE reconciliations ADD COLUMN decision_trace TEXT").run();
    }

    const auditCols = (db.prepare("PRAGMA table_info('audit_events')").all() as any[]).map((c) => c.name);
    if (!auditCols.includes('prev_hash')) {
      db.prepare("ALTER TABLE audit_events ADD COLUMN prev_hash TEXT NOT NULL DEFAULT ''").run();
    }
    if (!auditCols.includes('hash')) {
      db.prepare("ALTER TABLE audit_events ADD COLUMN hash TEXT NOT NULL DEFAULT ''").run();
    }

    const aiCols = (db.prepare("PRAGMA table_info('ai_extractions')").all() as any[]).map((c) => c.name);
    if (!aiCols.includes('is_correction')) {
      db.prepare("ALTER TABLE ai_extractions ADD COLUMN is_correction INTEGER NOT NULL DEFAULT 0").run();
    }
    if (!aiCols.includes('correction_target_id')) {
      db.prepare("ALTER TABLE ai_extractions ADD COLUMN correction_target_id TEXT").run();
    }
    if (!aiCols.includes('is_duplicate')) {
      db.prepare("ALTER TABLE ai_extractions ADD COLUMN is_duplicate INTEGER NOT NULL DEFAULT 0").run();
    }
    if (!aiCols.includes('duplicate_of_id')) {
      db.prepare("ALTER TABLE ai_extractions ADD COLUMN duplicate_of_id TEXT").run();
    }
  } catch (err) {
    // Migration fallback
  }
}
