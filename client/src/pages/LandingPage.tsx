import React from 'react';
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
} from 'lucide-react';
import { HonestyGuaranteeBanner, PayPalSandboxNotice } from '../components/Disclaimers';

interface LandingPageProps {
  onExplore: (tab: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onExplore }) => {
  return (
    <div className="space-y-10 py-4">
      {/* Top Disclaimers */}
      <HonestyGuaranteeBanner />
      <PayPalSandboxNotice />

      {/* Hero Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-12 shadow-xs relative overflow-hidden">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700">
            <Coins className="w-3.5 h-3.5 text-emerald-600" />
            Fintech Group Reconciliation & Provider Audit
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Know what your group owes.{' '}
            <span className="text-slate-500 font-normal">See what payments actually cost.</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
            When friends and colleagues travel internationally, group accounting and actual payment outcomes become disconnected.
            ClearSettle bridges this gap: deterministic multi-currency accounting, responsible AI statement classification, and server-verified PayPal sandbox reconciliation.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => onExplore('dashboard')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition-all shadow-sm"
            >
              <span>Explore Group Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onExplore('reconciliation')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-medium text-sm border border-indigo-200 transition-all"
            >
              <GitCompare className="w-4 h-4 text-indigo-600" />
              <span>Inspect Payment Reconciliation</span>
            </button>
            <button
              onClick={() => onExplore('ai-import')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-medium text-sm transition-all"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>Test AI Chat Intelligence</span>
            </button>
          </div>
        </div>

        {/* Floating Abstract Badge */}
        <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="text-xl font-bold text-slate-900 mono-numeric">Exact Decimal</div>
            <div className="text-xs text-slate-500">Zero float precision loss</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="text-xl font-bold text-slate-900 mono-numeric">5 Strict Classes</div>
            <div className="text-xs text-slate-500">Expense vs Promise vs Repay</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="text-xl font-bold text-slate-900 mono-numeric">N - K Transfers</div>
            <div className="text-xs text-slate-500">Zero-sum partition theorem</div>
          </div>
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div className="text-xl font-bold text-slate-900 mono-numeric">4-Way Audit</div>
            <div className="text-xs text-slate-500">Ledger vs Quote vs Capture</div>
          </div>
        </div>
      </div>

      {/* Core Architectural Promises Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Deterministic Financial Math</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            All arithmetic is calculated using exact decimal precision (Decimal.js). Currencies follow ISO 4217 minor unit rules (EUR/USD 2, JPY 0).
            Penny remainders are distributed algorithmically so the sum of split shares matches the total with zero lost cents.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center border border-amber-100">
            <Sparkles className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Responsible AI Expense Intelligence</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            The AI categorizes statements into Confirmed Expenses, Repayments, Payment Promises, Proposed Expenses, and Unresolved disputes.
            It never guesses missing numbers and requires human verification before any record enters the ledger.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200/80 p-6 space-y-3 shadow-xs">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center border border-indigo-100">
            <GitCompare className="w-5 h-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Payment Reconciliation Engine</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            PayPal Orders v2 sandbox checkout responses are verified server-side.
            The platform contrasts the ledger expected amount, the provider quote, and actual captured net proceeds, transparently exposing processor fees.
          </p>
        </div>
      </div>

      {/* Seeded Trip Quick Access Card */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 sm:p-8 text-white shadow-sm flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-xs font-mono">
            <span>● SEEDED HACKATHON DATASET READY</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold">Tokyo & Munich Global Summit 2026</h2>
          <p className="text-xs text-slate-300 max-w-xl">
            Pre-seeded with 3 international participants: Alex (Germany — EUR), Sam (United States — USD), and John (Japan — JPY).
            Includes hotel, restaurant, and transit expenses in multiple currencies, plus a pre-configured PayPal reconciliation showcase.
          </p>
        </div>
        <button
          onClick={() => onExplore('dashboard')}
          className="shrink-0 px-6 py-3 rounded-xl bg-white text-slate-950 font-semibold text-sm hover:bg-slate-100 transition-colors shadow-sm"
        >
          Open Seeded Trip Dashboard
        </button>
      </div>
    </div>
  );
};
