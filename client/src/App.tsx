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
  resetDemoData,
  initDemoSession,
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
} from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<string>('welcome');
  const [workspaceType, setWorkspaceType] = useState<'PERSONAL' | 'BUSINESS'>('PERSONAL');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('group-intl-trip-2026');
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

  // Load all data
  const loadGroupData = async (groupId: string) => {
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
        fetchGroupDetails(groupId),
        fetchGroupBalances(groupId),
        fetchExpenses(groupId),
        fetchAIItems(groupId),
        fetchSettlementStrategies(groupId),
        fetchReconciliations(groupId),
        fetchAuditEvents(groupId),
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
      if (!getAuthToken()) {
        try {
          await initDemoSession('alex-organizer');
        } catch (authErr) {
          console.warn('Could not initialize demo session:', authErr);
        }
      }

      const [groupsRes, configRes] = await Promise.all([fetchGroups(), fetchConfig()]);
      setGroups(groupsRes);
      setSystemConfig(configRes);

      const targetId = groupsRes[0]?.id || selectedGroupId;
      setSelectedGroupId(targetId);
      await loadGroupData(targetId);
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
            {activeTab === 'welcome' && <LandingPage onExplore={(tab) => setActiveTab(tab)} />}

            {activeTab === 'invoices' && (
              <BusinessInvoicesPage
                workspaceId="workspace-agency-demo"
                onNavigateToReconciliation={() => setActiveTab('reconciliation')}
              />
            )}

            {activeTab === 'dashboard' && (
              <DashboardPage
                group={groupDetails}
                balanceSummary={balances}
                onNavigate={(tab) => setActiveTab(tab)}
                pendingReviewsCount={pendingCount}
              />
            )}

            {activeTab === 'group' && (
              <GroupPage
                group={groupDetails}
                balanceSummary={balances}
                onRefresh={() => loadGroupData(selectedGroupId)}
              />
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
              <LedgerPage
                group={groupDetails}
                expenses={expenses}
                onRefresh={() => loadGroupData(selectedGroupId)}
              />
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

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200/80 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">ClearSettle</span>
            <span>— AI-Assisted Group Expense Reconciliation Platform</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>PayPal Sandbox Integration</span>
            <span>•</span>
            <span>Exact Decimal Arithmetic</span>
            <span>•</span>
            <span>Responsible AI Classification</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
