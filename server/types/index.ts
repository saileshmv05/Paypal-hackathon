// Core domain types for ClearSettle

export type CurrencyCode = 'EUR' | 'USD' | 'GBP' | 'INR' | 'JPY';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  name: string;
  decimals: number; // ISO 4217 minor units (e.g. 2 for EUR/USD, 0 for JPY)
  flag: string;
  country: string;
}

export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENT';

export type ExpenseStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export type AIClassification = 
  | 'CONFIRMED_EXPENSE'
  | 'REPAYMENT'
  | 'PAYMENT_PROMISE'
  | 'PROPOSED_EXPENSE'
  | 'UNRESOLVED';

export type ProviderType = 'PAYPAL_SANDBOX' | 'DEMO_PROVIDER' | 'MANUAL';

export type TransactionStatus = 'CREATED' | 'APPROVED' | 'CAPTURED' | 'FAILED';

export type QuoteStatus = 'QUOTE_PENDING' | 'QUOTE_AVAILABLE' | 'QUOTE_EXPIRED' | 'UNAVAILABLE';

export type ReconciliationStatus = 
  | 'QUOTE_PENDING'
  | 'QUOTE_AVAILABLE'
  | 'QUOTE_EXPIRED'
  | 'CAPTURE_PENDING'
  | 'CAPTURE_CONFIRMED'
  | 'CAPTURE_FAILED'
  | 'RECONCILIATION_COMPLETE'
  | 'RECONCILIATION_INCOMPLETE';

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
  expenseId: string;
  memberId: string;
  shareAmount: string; // Exact Decimal string in original currency
  shareBaseAmount: string; // Exact Decimal string in base currency
}

export interface Expense {
  id: string;
  groupId: string;
  payerId: string;
  description: string;
  category: string;
  originalAmount: string; // Decimal string
  originalCurrency: CurrencyCode;
  baseAmount: string; // Decimal string in group base currency
  exchangeRate: string; // Decimal string
  rateSource: string; // e.g. "ECB_REFERENCE", "FIXER_MARKET"
  rateTimestamp: string;
  rateDirection: 'BASE_TO_ORIGINAL' | 'ORIGINAL_TO_BASE';
  splitType: SplitType;
  evidenceType: 'MANUAL' | 'RECEIPT' | 'CONVERSATION';
  evidenceRef?: string;
  status: ExpenseStatus;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  splits?: ExpenseSplit[];
}

export interface ParticipantBalance {
  memberId: string;
  memberName: string;
  preferredCurrency: CurrencyCode;
  netInBase: string; // positive = owed money (creditor), negative = owes money (debtor)
  netInPreferred: string;
  totalPaidBase: string;
  totalOwedBase: string;
}

export interface SettlementTransfer {
  id: string;
  planId: string;
  fromMemberId: string;
  fromMemberName: string;
  toMemberId: string;
  toMemberName: string;
  amount: string; // Decimal string
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
  createdAt: string;
  transfers: SettlementTransfer[];
  zeroSumSubsetsCount?: number;
  explanation: string;
}

export interface ProviderQuote {
  id: string;
  transactionId: string;
  quotedAmount: string;
  quotedCurrency: CurrencyCode;
  providerFxRate: string | null;
  quoteId: string | null;
  expiresAt: string | null;
  status: QuoteStatus;
  unavailableReason?: string;
}

export interface CaptureResult {
  id: string;
  transactionId: string;
  providerCaptureId: string;
  grossAmount: string;
  grossCurrency: CurrencyCode;
  feeAmount: string;
  feeCurrency: CurrencyCode;
  netAmount: string;
  netCurrency: CurrencyCode;
  effectiveFxRate: string | null;
  receivableAmount: string | null;
  receivableCurrency: CurrencyCode | null;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  rawSanitizedResponse: Record<string, any>;
  createdAt: string;
}

export type ReconciliationMatchStatus =
  | 'MATCHED'
  | 'PARTIALLY_PAID'
  | 'PARTIALLY_MATCHED'
  | 'OVERPAID'
  | 'UNDERPAID'
  | 'FAILED'
  | 'PENDING'
  | 'UNMATCHED'
  | 'NEEDS_REVIEW'
  | 'REQUIRES_REVIEW';

export type ProvenanceBadge = 'LEDGER' | 'ESTIMATE' | 'QUOTE' | 'PAYPAL-CAPTURE' | 'SIMULATED' | 'MANUAL' | 'UNVERIFIED';

export interface ReconciliationRecord {
  id: string;
  transferId: string;
  transactionId: string;
  provider: ProviderType;
  status: ReconciliationStatus;
  matchStatus?: ReconciliationMatchStatus;
  captureProvenance: 'PAYPAL-CAPTURE' | 'SIMULATED' | 'MANUAL';
  
  // 1. Group Ledger Value
  ledgerOriginalAmount: string;
  ledgerOriginalCurrency: CurrencyCode;
  ledgerReferenceRate: string;
  ledgerRateSource: string;
  ledgerRateTimestamp: string;
  ledgerConvertedBaseAmount: string;
  ledgerBaseCurrency: CurrencyCode;

  // 2. Provider Quotation
  quoteAmount: string | null;
  quoteCurrency: CurrencyCode | null;
  quoteFxRate: string | null;
  quoteId: string | null;
  quoteExpiresAt: string | null;
  quoteStatus: QuoteStatus;

  // 3. Actual Provider Result
  captureId: string | null;
  captureGrossAmount: string | null;
  captureGrossCurrency: CurrencyCode | null;
  captureFeeAmount: string | null;
  captureFeeCurrency: CurrencyCode | null;
  captureNetAmount: string | null;
  captureNetCurrency: CurrencyCode | null;
  captureEffectiveRate: string | null;
  captureReceivableAmount: string | null;
  captureReceivableCurrency: CurrencyCode | null;
  captureTimestamp: string | null;

  // 4. Reconciliation Math
  diffLedgerVsCaptureGross: string | null;
  diffQuoteVsCaptureGross: string | null;
  observedProviderFee: string | null;
  unobservableChargesEstimate: string | null;
  explanation: string;
  decisionTrace?: {
    expectedAmount: string;
    capturedGross: string;
    providerFee: string;
    netReceived: string;
    variance: string;
    summary: string;
  };
  createdAt: string;
}

export interface AIExtractionItem {
  id: string;
  classification: AIClassification;
  confidenceScore: number;
  payerName?: string;
  payerId?: string;
  involvedMembers: string[];
  amount?: string;
  currency?: CurrencyCode;
  description: string;
  date?: string;
  sourceText: string;
  splitType: SplitType;
  missingInformation: string[];
  explanation: string;
  isCorrection?: boolean;
  correctionTargetId?: string;
  isDuplicate?: boolean;
  duplicateOfId?: string;
  status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
}

export interface AuditEvent {
  id: string;
  groupId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  actor: string;
  description: string;
  metadata: Record<string, any>;
  prevHash: string;
  hash: string;
  createdAt: string;
}

// ----------------------------------------------------------------------
// WORKSPACE & SMALL BUSINESS DOMAIN TYPES
// ----------------------------------------------------------------------
export type WorkspaceType = 'PERSONAL' | 'BUSINESS';

export interface Workspace {
  id: string;
  name: string;
  type: WorkspaceType;
  baseCurrency: CurrencyCode;
  ownerName: string;
  description?: string;
  createdAt: string;
}

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED';

export interface Invoice {
  id: string;
  workspaceId: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  description: string;
  amount: string; // Exact Decimal string
  currency: CurrencyCode;
  baseAmount: string; // Converted base amount
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  paidAmount: string;
  paypalOrderId?: string;
  reconciliationId?: string;
  createdAt: string;
}

export interface Client {
  id: string;
  workspaceId: string;
  name: string;
  email: string;
  company?: string;
  country: string;
  preferredCurrency: CurrencyCode;
  createdAt: string;
}

export interface UserContext {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'OWNER';
  groupIds: string[];
  workspaceIds: string[];
}
