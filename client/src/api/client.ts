import {
  AIExtractionItem,
  AuditEvent,
  Group,
  GroupBalanceSummary,
  Expense,
  ReconciliationRecord,
  SettlementPlan,
  SystemConfig,
} from '../types';

const API_BASE = '/api';

export async function fetchConfig(): Promise<SystemConfig> {
  const res = await fetch(`${API_BASE}/config`);
  if (!res.ok) throw new Error('Failed to fetch system config');
  return res.json();
}

export async function resetDemoData(): Promise<void> {
  const res = await fetch(`${API_BASE}/demo/reset`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to reset demo data');
}

export async function fetchGroups(): Promise<Group[]> {
  const res = await fetch(`${API_BASE}/groups`);
  if (!res.ok) throw new Error('Failed to fetch groups');
  return res.json();
}

export async function fetchGroupDetails(id: string): Promise<Group> {
  const res = await fetch(`${API_BASE}/groups/${id}`);
  if (!res.ok) throw new Error('Failed to fetch group details');
  return res.json();
}

export async function createGroup(data: { name: string; description: string; baseCurrency: string }): Promise<Group> {
  const res = await fetch(`${API_BASE}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create group');
  return res.json();
}

export async function addMember(
  groupId: string,
  data: { name: string; country: string; preferredCurrency: string; email?: string }
): Promise<any> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add participant');
  return res.json();
}

export async function fetchGroupBalances(groupId: string): Promise<GroupBalanceSummary> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/balances`);
  if (!res.ok) throw new Error('Failed to fetch group balances');
  return res.json();
}

export async function fetchExpenses(groupId: string): Promise<Expense[]> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/expenses`);
  if (!res.ok) throw new Error('Failed to fetch expenses');
  return res.json();
}

export async function createExpense(
  groupId: string,
  data: {
    payerId: string;
    description: string;
    category?: string;
    originalAmount: string;
    originalCurrency: string;
    splitMemberIds: string[];
    evidenceType?: string;
    evidenceRef?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create expense');
  }
  return res.json();
}

export async function fetchSettlementStrategies(groupId: string): Promise<{
  baseCurrency: string;
  summary: GroupBalanceSummary;
  strategies: {
    MIN_TRANSFERS: SettlementPlan;
    MIN_COST: SettlementPlan;
  };
  transparencyNotice: string;
}> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/settlement`);
  if (!res.ok) throw new Error('Failed to fetch settlement strategies');
  return res.json();
}

export async function runAIExtraction(
  groupId: string,
  input: string,
  sourceType: 'CONVERSATION' | 'RECEIPT'
): Promise<{ engine: string; isLiveAI: boolean; overallSummary: string; items: AIExtractionItem[] }> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/ai/extract`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input, sourceType }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'AI Extraction failed');
  }
  return res.json();
}

export async function fetchAIItems(groupId: string): Promise<AIExtractionItem[]> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/ai/items`);
  if (!res.ok) throw new Error('Failed to fetch AI items');
  return res.json();
}

export async function approveAIItem(
  groupId: string,
  itemId: string,
  overrideData?: {
    payerId?: string;
    amount?: string;
    currency?: string;
    description?: string;
    splitMemberIds?: string[];
  }
): Promise<any> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/ai/items/${itemId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(overrideData || {}),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to approve AI item');
  }
  return res.json();
}

export async function rejectAIItem(groupId: string, itemId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/ai/items/${itemId}/reject`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reject AI item');
  return res.json();
}

export async function createPayPalOrder(data: {
  transferId?: string;
  invoiceId?: string;
  obligationType?: 'SETTLEMENT' | 'INVOICE';
  amount?: string;
  currency?: string;
  description?: string;
}): Promise<{ providerOrderId: string; approvalUrl?: string; status: string; amount?: string; currency?: string }> {
  const res = await fetch(`${API_BASE}/paypal/create-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create PayPal order');
  }
  return res.json();
}

export async function capturePayPalOrder(data: {
  providerOrderId: string;
  transferId?: string;
  invoiceId?: string;
  groupId?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/paypal/capture-order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to capture PayPal order');
  }
  return res.json();
}

export async function fetchReconciliations(groupId: string): Promise<ReconciliationRecord[]> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/reconciliations`);
  if (!res.ok) throw new Error('Failed to fetch reconciliations');
  return res.json();
}

// ----------------------------------------------------------------------
// SMALL BUSINESS WORKSPACE & INVOICING API
// ----------------------------------------------------------------------
export async function fetchWorkspaces(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/workspaces`);
  if (!res.ok) throw new Error('Failed to fetch workspaces');
  return res.json();
}

export async function fetchInvoices(workspaceId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/invoices`);
  if (!res.ok) throw new Error('Failed to fetch invoices');
  return res.json();
}

export async function createInvoice(workspaceId: string, data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create invoice');
  }
  return res.json();
}

export async function parseInvoiceText(workspaceId: string, input: string): Promise<any> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/invoices/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error('Failed to parse invoice text');
  return res.json();
}

export async function verifyAuditChain(groupId: string): Promise<{ isValid: boolean; totalEvents: number; verifiedAt: string; errors: string[] }> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/audit/verify`);
  if (!res.ok) throw new Error('Failed to verify audit chain');
  return res.json();
}

export async function fetchAuditEvents(groupId: string): Promise<AuditEvent[]> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/audit`);
  if (!res.ok) throw new Error('Failed to fetch audit events');
  return res.json();
}

export async function fetchEvidenceSummary(): Promise<{ exists: boolean; records: any[] }> {
  const res = await fetch(`${API_BASE}/evidence/summary`);
  if (!res.ok) return { exists: false, records: [] };
  return res.json();
}
