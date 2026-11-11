import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { GroupPage } from './pages/GroupPage';
import { AIImportPage } from './pages/AIImportPage';
import { ReviewQueuePage } from './pages/ReviewQueuePage';
import { LedgerPage } from './pages/LedgerPage';
import { SettlementPage } from './pages/SettlementPage';
import { ReconciliationPage } from './pages/ReconciliationPage';
import { AuditPage } from './pages/AuditPage';
import { SettingsPage } from './pages/SettingsPage';
import { BusinessInvoicesPage } from './pages/BusinessInvoicesPage';
import { AuthModal } from './components/AuthModal';
import { CreateGroupModal } from './components/CreateGroupModal';
import { CreateWorkspaceModal } from './components/CreateWorkspaceModal';
import {
  fetchConfig,
  fetchGroups,
  fetchGroupDetails,
  fetchGroupBalances,
  fetchExpenses,
  fetchAIItems,
  fetchSettlementStrategies,
  fetchReconciliations,
  fetchAuditEvents,
  fetchWorkspaces,
  resetDemoData,
  initDemoSession,
  fetchAuthSession,
  logoutSession,
  getAuthToken,
} from './api/client';
import {
  Group,
  GroupBalanceSummary,
  Expense,
  AIExtractionItem,
  SettlementPlan,
  ReconciliationRecord,
  AuditEvent,
  SystemConfig,
  SettlementTransfer,
  UserContext,
} from './types';
import { Users, Building, Plus } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('welcome');
  const [workspaceType, setWorkspaceType] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [groupDetails, setGroupDetails] = useState<Group | null>(null);
  const [balances, setBalances] = useState<GroupBalanceSummary | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [aiItems, setAiItems] = useState<AIExtractionItem[]>([]);
  const [settlementData, setSettlementData] = useState<{
    baseCurrency: string;
    summary: GroupBalanceSummary;
    strategies: {
      MIN_TRANSFERS: SettlementPlan;
      MIN_COST: SettlementPlan;
    };
    transparencyNotice: string;
  } | null>(null);
  const [reconciliations, setReconciliations] = useState<ReconciliationRecord[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [activeCheckoutTransfer, setActiveCheckoutTransfer] = useState<SettlementTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [paypalNotification, setPaypalNotification] = useState<string | null>(null);

  // Authentication & Modals State
  const [currentUser, setCurrentUser] = useState<UserContext | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'LOGIN' | 'REGISTER' | 'DEMO'>('LOGIN');
  const [createGroupModalOpen, setCreateGroupModalOpen] = useState(false);
  const [createWorkspaceModalOpen, setCreateWorkspaceModalOpen] = useState(false);

  // Workspaces State
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('workspace-agency-demo');

  // Check URL params for PayPal Return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('paypalReturn') === 'true') {
      const token = params.get('token');
      setPaypalNotification(
        `PayPal Sandbox Checkout Approved by Buyer (Order Token: ${token || 'Verified'}). Transaction ready for capture & audit.`
      );
      setActiveTab('reconciliation');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('paypalCancel') === 'true') {
      setPaypalNotification('PayPal checkout session was cancelled by buyer.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  // Load group details, balances, expenses, settlement strategies, and reconciliations
  const loadGroupData = async (groupId: string) => {
    if (!groupId) {
      setGroupDetails(null);
      setBalances(null);
      setExpenses([]);
      setAiItems([]);
      setSettlementData(null);
      setReconciliations([]);
      setAuditEvents([]);
      return;
    }

    try {
      const [
        groupRes,
        balancesRes,
        expensesRes,
        aiRes,
        settlementRes,
        reconRes,
        auditRes,
      ] = await Promise.all([
        fetchGroupDetails(groupId).catch(() => null),
        fetchGroupBalances(groupId).catch(() => null),
        fetchExpenses(groupId).catch(() => []),
        fetchAIItems(groupId).catch(() => []),
        fetchSettlementStrategies(groupId).catch(() => null),
        fetchReconciliations(groupId).catch(() => []),
        fetchAuditEvents(groupId).catch(() => []),
      ]);

      setGroupDetails(groupRes);
      setBalances(balancesRes);
      setExpenses(expensesRes);
      setAiItems(aiRes);
      setSettlementData(settlementRes);
      setReconciliations(reconRes);
      setAuditEvents(auditRes);
    } catch (err) {
      console.error('Error loading group data:', err);
    }
  };

  const initialLoad = async () => {
    setLoading(true);
    try {
      // 1. Check if user already has an active session
      let user: UserContext | null = null;
      if (getAuthToken()) {
        const session = await fetchAuthSession();
        if (session.authenticated && session.user) {
          user = session.user;
          setCurrentUser(user);
        }
      }

      // If no session exists yet, default to demo session for instant judging accessibility
      if (!user) {
        try {
          const demoSession = await initDemoSession('alex-organizer');
          user = { ...demoSession.user, isDemo: true };
          setCurrentUser(user);
        } catch (e) {
          console.warn('Could not auto-start demo session:', e);
        }
      }

      // 2. Load groups, workspaces, and system config for this user
      const [groupsRes, workspacesRes, configRes] = await Promise.all([
        fetchGroups().catch(() => []),
        fetchWorkspaces().catch(() => []),
        fetchConfig().catch(() => null),
      ]);

      setGroups(groupsRes);
      setWorkspaces(workspacesRes);
      setSystemConfig(configRes);

      if (workspacesRes.length > 0) {
        setSelectedWorkspaceId(workspacesRes[0].id);
      }

      if (groupsRes.length > 0) {
        const targetId = groupsRes[0].id;
        setSelectedGroupId(targetId);
        await loadGroupData(targetId);
      } else {
        setSelectedGroupId('');
        setGroupDetails(null);
      }
    } catch (err) {
      console.error('Initial load failed:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initialLoad();
  }, []);

  useEffect(() => {
    if (selectedGroupId) {
      loadGroupData(selectedGroupId);
    }
  }, [selectedGroupId]);

  const handleResetDemo = async () => {
    if (window.confirm('Reset all demonstration data to the baseline Tokyo & Munich Summit 2026?')) {
      await resetDemoData();
      await initialLoad();
      setActiveTab('dashboard');
    }
  };

  const handleAuthSuccess = async (user: UserContext) => {
    setCurrentUser(user);
    await initialLoad();
    setActiveTab('dashboard');
  };

  const handleLogout = async () => {
    await logoutSession();
    setCurrentUser(null);
    setGroups([]);
    setSelectedGroupId('');
    setGroupDetails(null);
    setWorkspaces([]);
    setActiveTab('welcome');
  };

  const handleGroupCreated = async (newGroup: Group) => {
    setGroups((prev) => [newGroup, ...prev]);
    setSelectedGroupId(newGroup.id);
    await loadGroupData(newGroup.id);
    setActiveTab('dashboard');
  };

  const handleWorkspaceCreated = async (newWs: any) => {
    setWorkspaces((prev) => [newWs, ...prev]);
    setSelectedWorkspaceId(newWs.id);
    setWorkspaceType('BUSINESS');
    setActiveTab('invoices');
  };

  const pendingCount = aiItems.filter((i) => i.status === 'PENDING_REVIEW').length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        groups={groups}
        selectedGroupId={selectedGroupId}
        setSelectedGroupId={setSelectedGroupId}
        pendingReviewsCount={pendingCount}
        workspaceType={workspaceType}
        setWorkspaceType={(type) => {
          setWorkspaceType(type);
          if (type === 'BUSINESS') {
            setActiveTab('invoices');
          } else if (activeTab === 'invoices') {
            setActiveTab('dashboard');
          }
        }}
        onResetDemo={handleResetDemo}
        currentUser={currentUser}
        onOpenAuth={(mode = 'LOGIN') => {
          setAuthModalMode(mode);
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
        onOpenCreateGroup={() => setCreateGroupModalOpen(true)}
        onOpenCreateWorkspace={() => setCreateWorkspaceModalOpen(true)}
        workspaces={workspaces}
        selectedWorkspaceId={selectedWorkspaceId}
        setSelectedWorkspaceId={setSelectedWorkspaceId}
      />

      {paypalNotification && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-3 sm:px-6">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-emerald-800">
              <span className="font-semibold">PayPal Notice:</span>
              <span>{paypalNotification}</span>
            </div>
            <button
              onClick={() => setPaypalNotification(null)}
              className="text-emerald-600 hover:text-emerald-800 text-xs font-medium"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="p-16 text-center text-xs text-slate-500 font-medium">
            Loading ClearSettle Financial Ledger...
          </div>
        ) : (
          <>
            {activeTab === 'welcome' && (
              <LandingPage
                onExplore={(tab) => setActiveTab(tab)}
                onOpenAuth={(mode = 'LOGIN') => {
                  setAuthModalMode(mode);
                  setAuthModalOpen(true);
                }}
              />
            )}

            {activeTab === 'invoices' && (
              <BusinessInvoicesPage
                workspaceId={selectedWorkspaceId || 'workspace-agency-demo'}
                onNavigateToReconciliation={() => setActiveTab('reconciliation')}
                onOpenCreateWorkspace={() => setCreateWorkspaceModalOpen(true)}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardPage
                group={groupDetails}
                balanceSummary={balances}
                onNavigate={(tab) => setActiveTab(tab)}
                pendingReviewsCount={pendingCount}
                onOpenCreateGroup={() => setCreateGroupModalOpen(true)}
                onOpenAuth={(mode = 'DEMO') => {
                  setAuthModalMode(mode);
                  setAuthModalOpen(true);
                }}
              />
            )}

            {activeTab === 'group' && (
              groupDetails ? (
                <GroupPage
                  group={groupDetails}
                  balanceSummary={balances}
                  onRefresh={() => loadGroupData(selectedGroupId)}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-4">
                  <Users className="w-10 h-10 text-slate-400 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-900">No Group Selected</h3>
                  <p className="text-xs text-slate-500">Create a group or select an existing one to manage members.</p>
                  <button
                    onClick={() => setCreateGroupModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
                  >
                    + Create Group
                  </button>
                </div>
              )
            )}

            {activeTab === 'ai-import' && (
              <AIImportPage
                group={groupDetails}
                onNavigateToReview={() => setActiveTab('review-queue')}
                onExtractionCompleted={() => loadGroupData(selectedGroupId)}
              />
            )}

            {activeTab === 'review-queue' && (
              <ReviewQueuePage
                group={groupDetails}
                items={aiItems}
                onRefresh={() => loadGroupData(selectedGroupId)}
                onNavigateToLedger={() => setActiveTab('ledger')}
              />
            )}

            {activeTab === 'ledger' && (
              groupDetails ? (
                <LedgerPage
                  group={groupDetails}
                  expenses={expenses}
                  onRefresh={() => loadGroupData(selectedGroupId)}
                />
              ) : (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto space-y-4">
                  <h3 className="text-sm font-bold text-slate-900">No Ledger Available</h3>
                  <p className="text-xs text-slate-500">Create your first group to start recording and splitting expenses.</p>
                  <button
                    onClick={() => setCreateGroupModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold"
                  >
                    + Create Group
                  </button>
                </div>
              )
            )}

            {activeTab === 'optimizer' && (
              <SettlementPage
                group={groupDetails}
                balanceSummary={balances}
                strategies={settlementData ? settlementData.strategies : null}
                onInitiatePayment={(transfer) => {
                  setActiveCheckoutTransfer(transfer);
                  setActiveTab('reconciliation');
                }}
              />
            )}

            {activeTab === 'reconciliation' && (
              <ReconciliationPage
                group={groupDetails}
                reconciliations={reconciliations}
                activeTransfer={activeCheckoutTransfer}
                onClosePaymentModal={() => setActiveCheckoutTransfer(null)}
                onPaymentSuccess={() => {
                  loadGroupData(selectedGroupId);
                  setActiveCheckoutTransfer(null);
                }}
              />
            )}

            {activeTab === 'audit' && <AuditPage group={groupDetails} events={auditEvents} />}

            {activeTab === 'settings' && (
              <SettingsPage config={systemConfig} onResetDemo={handleResetDemo} />
            )}
          </>
        )}
      </main>

      {/* Modals */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      <CreateGroupModal
        isOpen={createGroupModalOpen}
        onClose={() => setCreateGroupModalOpen(false)}
        onGroupCreated={handleGroupCreated}
      />

      <CreateWorkspaceModal
        isOpen={createWorkspaceModalOpen}
        onClose={() => setCreateWorkspaceModalOpen(false)}
        onWorkspaceCreated={handleWorkspaceCreated}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">ClearSettle</span>
            <span>— Financial Obligation Management & Payment Reconciliation</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>PayPal Orders v2 REST</span>
            <span>•</span>
            <span>Exact Decimal.js Arithmetic</span>
            <span>•</span>
            <span>SHA-256 Audit Chain</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
