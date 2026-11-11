export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'INR' | 'JPY';

export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENT';
export type ExpenseStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type AIClassification = 
  | 'CONFIRMED_EXPENSE'
  | 'REPAYMENT'
  | 'PAYMENT_PROMISE'
  | 'PROPOSED_EXPENSE'
  | 'UNRESOLVED';

export interface GroupMember {
  id: string;
  groupId: string;
  name: string;
  country: string;
  preferredCurrency: CurrencyCode;
  email: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  baseCurrency: CurrencyCode;
  createdAt: string;
  members?: GroupMember[];
}

export interface ExpenseSplit {
  id: string;
  expense_id: string;
  member_id: string;
  member_name?: string;
  share_amount: string;
  share_base_amount: string;
}

export interface Expense {
  id: string;
  group_id: string;
  payer_id: string;
  payer_name?: string;
  description: string;
  category: string;
  original_amount: string;
  original_currency: CurrencyCode;
  base_amount: string;
  exchange_rate: string;
  rate_source: string;
  rate_timestamp: string;
  rate_direction: string;
  split_type: SplitType;
  evidence_type: 'MANUAL' | 'RECEIPT' | 'CONVERSATION';
  evidence_ref?: string;
  status: ExpenseStatus;
  created_at: string;
  approved_at?: string;
  approved_by?: string;
  splits?: ExpenseSplit[];
}

export interface ParticipantBalance {
  memberId: string;
  memberName: string;
  preferredCurrency: CurrencyCode;
  netInBase: string;
  netInPreferred: string;
  totalPaidBase: string;
  totalOwedBase: string;
}

export interface GroupBalanceSummary {
  baseCurrency: CurrencyCode;
  totalExpensesBase: string;
  balances: ParticipantBalance[];
  isBalanced: boolean;
  discrepancyBase: string;
}

export interface SettlementTransfer {
  id: string;
  planId: string;
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amount: string;
  currency: CurrencyCode;
  targetAmount: string;
  targetCurrency: CurrencyCode;
  estimatedFee: string;
  status: 'PENDING' | 'INITIATED' | 'COMPLETED' | 'SETTLED_EXTERNALLY';
  paypalOrderId?: string;
  reconciliationId?: string;
}

export interface SettlementPlan {
  id: string;
  groupId: string;
  strategy: 'MIN_TRANSFERS' | 'MIN_COST';
  totalDebtVolumeBase: string;
  estimatedFeeCostBase: string;
  zeroSumSubsetsCount?: number;
  explanation: string;
  createdAt: string;
  transfers: SettlementTransfer[];
}

export type ReconciliationMatchStatus =
  | 'MATCHED'
  | 'PARTIALLY_MATCHED'
  | 'OVERPAID'
  | 'UNDERPAID'
  | 'FAILED'
  | 'PENDING'
  | 'UNMATCHED'
  | 'REQUIRES_REVIEW';

export interface ReconciliationRecord {
  id: string;
  transfer_id: string;
  transaction_id: string;
  provider: string;
  status: string;
  match_status?: ReconciliationMatchStatus;
  capture_provenance?: 'PAYPAL-CAPTURE' | 'SIMULATED';
  from_member_name?: string;
  to_member_name?: string;

  // 1. Ledger Value
  ledger_original_amount: string;
  ledger_original_currency: CurrencyCode;
  ledger_reference_rate: string;
  ledger_rate_source: string;
  ledger_rate_timestamp: string;
  ledger_converted_base_amount: string;
  ledger_base_currency: CurrencyCode;

  // 2. Provider Quotation
  quote_amount: string | null;
  quote_currency: CurrencyCode | null;
  quote_fx_rate: string | null;
  quote_id: string | null;
  quote_expires_at: string | null;
  quote_status: string | null;

  // 3. Provider Capture Result
  capture_id: string | null;
  capture_gross_amount: string | null;
  capture_gross_currency: CurrencyCode | null;
  capture_fee_amount: string | null;
  capture_fee_currency: CurrencyCode | null;
  capture_net_amount: string | null;
  capture_net_currency: CurrencyCode | null;
  capture_effective_rate: string | null;
  capture_receivable_amount: string | null;
  capture_receivable_currency: CurrencyCode | null;
  capture_timestamp: string | null;

  // 4. Reconciliation
  diff_ledger_vs_capture_gross: string | null;
  diff_quote_vs_capture_gross: string | null;
  observed_provider_fee: string | null;
  unobservable_charges_estimate: string | null;
  explanation: string;
  decisionTrace?: {
    expectedAmount: string;
    capturedGross: string;
    providerFee: string;
    netReceived: string;
    variance: string;
    summary: string;
  };
  created_at: string;
}

export interface AIExtractionItem {
  id: string;
  group_id?: string;
  classification: AIClassification;
  confidence_score?: number;
  confidenceScore?: number;
  payer_name?: string;
  payerName?: string;
  payer_id?: string;
  payerId?: string;
  involved_members?: string[];
  involvedMembers?: string[];
  amount?: string;
  currency?: CurrencyCode;
  description: string;
  date?: string;
  source_text?: string;
  sourceText?: string;
  split_type?: SplitType;
  splitType?: SplitType;
  missing_information?: string[];
  missingInformation?: string[];
  explanation: string;
  is_correction?: boolean;
  isCorrection?: boolean;
  is_duplicate?: boolean;
  isDuplicate?: boolean;
  duplicate_of_id?: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
}

export interface AuditEvent {
  id: string;
  group_id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  actor: string;
  description: string;
  metadata?: string;
  prev_hash?: string;
  hash?: string;
  created_at: string;
}

// ----------------------------------------------------------------------
// WORKSPACE & SMALL BUSINESS DOMAIN TYPES
// ----------------------------------------------------------------------
export type WorkspaceType = 'PERSONAL' | 'BUSINESS';

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  base_currency: CurrencyCode;
  owner_name: string;
  description?: string;
  created_at: string;
}

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED';

export interface Invoice {
  id: string;
  workspace_id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  description: string;
  amount: string;
  currency: CurrencyCode;
  base_amount: string;
  issue_date: string;
  due_date: string;
  status: InvoiceStatus;
  paid_amount: string;
  paypal_order_id?: string;
  reconciliation_id?: string;
  created_at: string;
}

export interface Client {
  id: string;
  workspace_id: string;
  name: string;
  email: string;
  company?: string;
  country: string;
  preferred_currency: CurrencyCode;
  created_at: string;
}

export interface SystemConfig {
  currencies: Record<string, any>;
  referenceRates: Record<string, string>;
  referenceMetadata: Record<string, string>;
  paypal: {
    isConfigured: boolean;
    mode: string;
    clientId: string;
    notice: string;
  };
  ai: {
    isLiveConfigured: boolean;
    engine: string;
  };
}
