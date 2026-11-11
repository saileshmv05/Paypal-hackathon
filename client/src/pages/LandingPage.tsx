import React, { useState } from 'react';
import {
  ShieldCheck,
  Scale,
  Sparkles,
  GitCompare,
  ArrowRight,
  Database,
  Coins,
  Globe2,
  CheckCircle2,
  Building,
  Users,
  Lock,
  FileText,
  Play,
  RotateCcw,
} from 'lucide-react';
import { HonestyGuaranteeBanner, PayPalSandboxNotice } from '../components/Disclaimers';

interface LandingPageProps {
  onExplore: (tab: string) => void;
  onOpenAuth: (mode?: 'LOGIN' | 'REGISTER' | 'DEMO') => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onExplore, onOpenAuth }) => {
  const [activePreviewTab, setActivePreviewTab] = useState<'PERSONAL' | 'BUSINESS' | 'RECON'>('PERSONAL');

  return (
    <div className="space-y-12 py-4">
      {/* Top Disclaimers */}
      <HonestyGuaranteeBanner />
      <PayPalSandboxNotice />

      {/* Hero Section */}
      <div className="bg-white rounded-3xl border border-slate-200/90 p-8 sm:p-14 shadow-xs relative overflow-hidden">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-800">
            <Coins className="w-3.5 h-3.5 text-emerald-600" />
            <span>Fintech Financial Obligation & Payment Reconciliation Engine</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Financial obligations{' '}
            <span className="text-indigo-600">made verifiable.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
            ClearSettle connects what people agreed to pay, what the financial ledger expects, what PayPal actually processed, and what the recipient actually received.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onOpenAuth('REGISTER')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-all shadow-sm"
            >
              <span>Create Free Account</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onOpenAuth('DEMO')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-sm border border-amber-200 transition-all shadow-xs"
            >
              <Play className="w-4 h-4 text-amber-700 fill-amber-700" />
              <span>Launch Demo Mode (Zero Credentials)</span>
            </button>
            <button
              onClick={() => onExplore('reconciliation')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-sm transition-all"
            >
              <GitCompare className="w-4 h-4 text-indigo-600" />
              <span>Inspect Payment Audit</span>
            </button>
          </div>
        </div>

        {/* Core Pillars Stats Strip */}
        <div className="mt-10 pt-8 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="text-xl font-bold text-slate-900 font-mono">Decimal.js</div>
            <div className="text-xs text-slate-500 mt-0.5">28-digit precision, zero float penny loss</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="text-xl font-bold text-slate-900 font-mono">N - K Partition</div>
            <div className="text-xs text-slate-500 mt-0.5">Exact zero-sum subset solver ($N \le 12$)</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="text-xl font-bold text-slate-900 font-mono">Orders v2</div>
            <div className="text-xs text-slate-500 mt-0.5">Authoritative DB lookups & capture binding</div>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <div className="text-xl font-bold text-slate-900 font-mono">SHA-256 Chain</div>
            <div className="text-xs text-slate-500 mt-0.5">Tamper-evident canonical metadata audit</div>
          </div>
        </div>
      </div>

      {/* Dual Segment Showcase: Personal vs Business */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">Two Connected Financial Segments</h2>
            <p className="text-xs text-slate-500">Built on one unified multi-currency ledger, split calculator, and payment reconciliation core.</p>
          </div>
          <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 text-xs font-semibold">
            <button
              onClick={() => setActivePreviewTab('PERSONAL')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activePreviewTab === 'PERSONAL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Personal Groups</span>
            </button>
            <button
              onClick={() => setActivePreviewTab('BUSINESS')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activePreviewTab === 'BUSINESS' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Building className="w-3.5 h-3.5 text-amber-600" />
              <span>Small Businesses</span>
            </button>
            <button
              onClick={() => setActivePreviewTab('RECON')}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                activePreviewTab === 'RECON' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5 text-emerald-600" />
              <span>Reconciliation Core</span>
            </button>
          </div>
        </div>

        {activePreviewTab === 'PERSONAL' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  USE CASE A
                </span>
                <h3 className="text-base font-bold text-slate-900">Personal Travel & Roommate Groups</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Track shared costs across EUR, USD, GBP, JPY, and INR. Supports Equal, Exact, Percentage, and Weighted Shares splits with deterministic remainder distribution.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => onExplore('dashboard')}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                  >
                    View Group Dashboard <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  AI INTELLIGENCE
                </span>
                <h3 className="text-base font-bold text-slate-900">Conversational Expense Extraction</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Parses group chat messages into 5 strict classes. Strict separation between confirmed expenses, payment promises, and repayments. Zero unauthorized ledger postings.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => onExplore('ai-import')}
                    className="text-xs font-semibold text-slate-700 hover:text-slate-900 inline-flex items-center gap-1"
                  >
                    Test Chat Parser <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  DEBT OPTIMIZATION
                </span>
                <h3 className="text-base font-bold text-slate-900">Zero-Sum Settlement Partition</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Solves the exact $(N - K)$ subset-sum partition theorem to minimize physical transfers, and contrasts it against a fee-aware settlement model that avoids retail FX spreads.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => onExplore('optimizer')}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 inline-flex items-center gap-1"
                  >
                    Compare Settlement Strategies <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activePreviewTab === 'BUSINESS' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-50 text-amber-700 border border-amber-200">
                  USE CASE B
                </span>
                <h3 className="text-base font-bold text-slate-900">Freelancer & Agency Workspaces</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Issue multi-currency invoices, manage client billing profiles, and track payment due dates with authoritative database records.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => onExplore('invoices')}
                    className="text-xs font-semibold text-amber-700 hover:text-amber-900 inline-flex items-center gap-1"
                  >
                    Explore Invoice Management <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                  PAYPAL CHECKOUT
                </span>
                <h3 className="text-base font-bold text-slate-900">Merchant Orders v2 Checkout</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Client invoice amounts are derived server-side. Orders are bound directly to invoice records, preventing payment tampering and duplicate capture callbacks.
                </p>
              </div>

              <div className="space-y-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  FINANCIAL AUDIT
                </span>
                <h3 className="text-base font-bold text-slate-900">Gross vs Net Proceeds Audit</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Inspects actual PayPal seller processing fees deducted from invoice payments. Reports verified net funds credited directly to your business account.
                </p>
              </div>
            </div>
          </div>
        )}

        {activePreviewTab === 'RECON' && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider">The Central Differentiator</div>
                <h3 className="text-lg font-bold text-slate-900">4-Way Comparative Payment Reconciliation</h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Generic apps assume €100 sent equals €100 received. ClearSettle proves what happened:
                </p>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                  <li><strong>Ledger Expectation:</strong> Original debt or invoice obligation in base currency.</li>
                  <li><strong>Provider Quotation:</strong> Honest reporting of quote availability.</li>
                  <li><strong>PayPal Result:</strong> Gross amount captured, processor fee deducted, net proceeds credited.</li>
                  <li><strong>Discrepancy Analysis:</strong> Payee shortfall variance and unobservable card issuer disclosures.</li>
                </ul>
              </div>

              <div className="bg-slate-900 rounded-xl p-5 text-white space-y-3">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                  <span className="font-semibold text-slate-300">Live Cryptographic Audit Trail</span>
                  <span className="font-mono text-emerald-400 text-[10px]">SHA-256 HASH CHAIN</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Every expense creation, split modification, PayPal order binding, and capture reconciliation produces an append-only audit event. Canonical JSON serialization guarantees tamper detection on all transaction metadata.
                </p>
                <button
                  onClick={() => onExplore('audit')}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium transition-colors"
                >
                  Verify Cryptographic Chain
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Seeded Demo Dataset Quick Launcher */}
      <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 text-white shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-xs font-mono">
            <span>● DEMO DATASET READY FOR JUDGES</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Tokyo & Munich Global Summit 2026 + Apex Creative Agency</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Pre-seeded with Alex (Germany — EUR), Sam (United States — USD), and John (Japan — JPY). Features hotel, dinner, transit multi-currency expenses, an active invoice for Nordic Innovations Oy, and complete reconciliation traces.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <button
            onClick={() => onOpenAuth('DEMO')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors shadow-xs"
          >
            Launch Demo Persona
          </button>
          <button
            onClick={() => onExplore('dashboard')}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs transition-colors border border-slate-700"
          >
            Explore Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};
