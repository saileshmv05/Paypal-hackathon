import {
  AIExtractionItem,
  AuditEvent,
  Group,
  GroupBalanceSummary,
  Expense,
  ReconciliationRecord,
  SettlementPlan,
  SystemConfig,
  UserContext,
} from '../types';

const API_BASE = '/api';

let authToken: string | null = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('cs_token') : null);

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof sessionStorage !== 'undefined') {
    if (token) {
      sessionStorage.setItem('cs_token', token);
    } else {
      sessionStorage.removeItem('cs_token');
    }
  }
}

export function getAuthToken(): string | null {
  return authToken;
}

function getHeaders(customHeaders: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { ...customHeaders };
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }
  return headers;
}

// ----------------------------------------------------------------------
// AUTHENTICATION & DEMO PERSONA API
// ----------------------------------------------------------------------
export async function initDemoSession(persona = 'alex-organizer'): Promise<{ token: string; user: UserContext }> {
  const res = await fetch(`${API_BASE}/auth/demo-session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona }),
  });
  if (!res.ok) throw new Error('Failed to initialize demo session');
  const data = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function registerUser(name: string, email: string, password: string): Promise<{ token: string; user: UserContext }> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Registration failed');
  }
  const data = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function loginUser(email: string, password: string): Promise<{ token: string; user: UserContext }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Login failed');
  }
  const data = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function getGoogleAuthConfig(): Promise<{ clientId: string; enabled: boolean; mode: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/google/config`);
    if (!res.ok) return { clientId: '', enabled: false, mode: 'DEMO_READY' };
    return res.json();
  } catch {
    return { clientId: '', enabled: false, mode: 'DEMO_READY' };
  }
}

export async function loginWithGoogle(params: {
  credential?: string;
  demo?: boolean;
  email?: string;
  name?: string;
}): Promise<{ token: string; user: UserContext }> {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Google authentication failed');
  }
  const data = await res.json();
  setAuthToken(data.token);
  return data;
}

export async function fetchAuthSession(): Promise<{ authenticated: boolean; user: UserContext | null }> {
  const res = await fetch(`${API_BASE}/auth/session`, {
    headers: getHeaders(),
  });
  if (!res.ok) return { authenticated: false, user: null };
  return res.json();
}

export async function fetchPersonas(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/auth/personas`);
  if (!res.ok) return [];
  return res.json();
}

export async function logoutSession(): Promise<void> {
  await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: getHeaders(),
  });
  setAuthToken(null);
}

// ----------------------------------------------------------------------
// CORE LEDGER & GROUPS API
// ----------------------------------------------------------------------
export async function fetchConfig(): Promise<SystemConfig> {
  const res = await fetch(`${API_BASE}/config`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch system config');
  return res.json();
}

export async function resetDemoData(): Promise<void> {
  const res = await fetch(`${API_BASE}/demo/reset`, {
    method: 'POST',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reset demo data');
  }
}

export async function fetchGroups(): Promise<Group[]> {
  const res = await fetch(`${API_BASE}/groups`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch groups');
  return res.json();
}

export async function fetchGroupDetails(id: string): Promise<Group> {
  const res = await fetch(`${API_BASE}/groups/${id}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch group details');
  return res.json();
}

export async function createGroup(data: { name: string; description: string; baseCurrency: string }): Promise<Group> {
  const res = await fetch(`${API_BASE}/groups`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
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
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to add participant');
  return res.json();
}

export async function fetchGroupBalances(groupId: string): Promise<GroupBalanceSummary> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/balances`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch group balances');
  return res.json();
}

export async function fetchExpenses(groupId: string): Promise<Expense[]> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/expenses`, { headers: getHeaders() });
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
    splitMemberIds?: string[];
    customSplits?: Array<{ memberId: string; amount?: string; percentage?: number }>;
    splitType?: string;
    evidenceType?: string;
    evidenceRef?: string;
  }
): Promise<any> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/expenses`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
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
  const res = await fetch(`${API_BASE}/groups/${groupId}/settlement`, { headers: getHeaders() });
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
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ input, sourceType }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'AI Extraction failed');
  }
  return res.json();
}

export async function fetchAIItems(groupId: string): Promise<AIExtractionItem[]> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/ai/items`, { headers: getHeaders() });
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
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(overrideData || {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to approve AI item');
  }
  return res.json();
}

export async function rejectAIItem(groupId: string, itemId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/ai/items/${itemId}/reject`, {
    method: 'POST',
    headers: getHeaders(),
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
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
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
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to capture PayPal order');
  }
  return res.json();
}

export async function recordManualSettlement(
  groupId: string,
  transferId: string,
  data: { notes?: string; evidenceRef?: string }
): Promise<any> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/settlements/${transferId}/manual-record`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to record manual settlement');
  }
  return res.json();
}

export async function fetchReconciliations(groupId: string): Promise<ReconciliationRecord[]> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/reconciliations`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch reconciliations');
  return res.json();
}

export async function fetchWorkspaceReconciliations(workspaceId: string): Promise<ReconciliationRecord[]> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/reconciliations`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch workspace reconciliations');
  return res.json();
}

// ----------------------------------------------------------------------
// SMALL BUSINESS WORKSPACE & INVOICING API
// ----------------------------------------------------------------------
export async function fetchWorkspaces(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/workspaces`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch workspaces');
  return res.json();
}

export async function createWorkspace(data: {
  name: string;
  type?: string;
  baseCurrency?: string;
  ownerName?: string;
  description?: string;
}): Promise<any> {
  const res = await fetch(`${API_BASE}/workspaces`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create workspace');
  }
  return res.json();
}

export async function fetchInvoices(workspaceId: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/invoices`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch invoices');
  return res.json();
}

export async function createInvoice(workspaceId: string, data: any): Promise<any> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/invoices`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create invoice');
  }
  return res.json();
}

export async function parseInvoiceText(workspaceId: string, input: string): Promise<any> {
  const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/invoices/parse`, {
    method: 'POST',
    headers: getHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ input }),
  });
  if (!res.ok) throw new Error('Failed to parse invoice text');
  return res.json();
}

export async function verifyAuditChain(groupId: string): Promise<{ isValid: boolean; totalEvents: number; verifiedAt: string; errors: string[]; brokenAtIndex: number | null }> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/audit/verify`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to verify audit chain');
  return res.json();
}

export async function fetchAuditEvents(groupId: string): Promise<AuditEvent[]> {
  const res = await fetch(`${API_BASE}/groups/${groupId}/audit`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Failed to fetch audit events');
  return res.json();
}

export async function fetchEvidenceSummary(): Promise<{ exists: boolean; records: any[] }> {
  const res = await fetch(`${API_BASE}/evidence/summary`, { headers: getHeaders() });
  if (!res.ok) return { exists: false, records: [] };
  return res.json();
}
