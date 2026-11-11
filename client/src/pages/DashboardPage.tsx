import React from 'react';
import {
  DollarSign,
  TrendingUp,
  Scale,
  Users,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  GitCompare,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Group, GroupBalanceSummary } from '../types';
import { HonestyGuaranteeBanner, PayPalSandboxNotice } from '../components/Disclaimers';

interface DashboardPageProps {
  group: Group | null;
  balanceSummary: GroupBalanceSummary | null;
  onNavigate: (tab: string) => void;
  pendingReviewsCount: number;
  onOpenCreateGroup?: () => void;
  onOpenAuth?: (mode?: 'LOGIN' | 'REGISTER' | 'DEMO') => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  group,
  balanceSummary,
  onNavigate,
  pendingReviewsCount,
  onOpenCreateGroup,
  onOpenAuth,
}) => {
  if (!group) {
    return (
      <div className="space-y-6 py-8">
        <HonestyGuaranteeBanner />
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-14 text-center max-w-lg mx-auto space-y-5 shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
            <Users className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">No Expense Groups Created Yet</h2>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Start by creating your first travel or shared expense group. You will be able to invite participants, record multi-currency expenses, and calculate exact settlements.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-3">
            {onOpenCreateGroup && (
              <button
                onClick={onOpenCreateGroup}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                + Create Personal Group
              </button>
            )}
            {onOpenAuth && (
              <button
                onClick={() => onOpenAuth('DEMO')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-semibold transition-colors"
              >
                Switch to Demo Mode
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const baseCurrency = balanceSummary?.baseCurrency || 'EUR';
  const balances = balanceSummary?.balances || [];

  // Prepare chart data
  const chartData = balances.map((b) => ({
    name: b.memberName,
    net: parseFloat(b.netInBase),
    preferred: `${b.netInPreferred} ${b.preferredCurrency}`,
    currency: baseCurrency,
  }));

  const totalExpenses = balanceSummary?.totalExpensesBase || '0.00';
  const isBalanced = balanceSummary?.isBalanced ?? true;

  return (
    <div className="space-y-8 py-2">
      <HonestyGuaranteeBanner />
      <PayPalSandboxNotice />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {group?.name || 'Group Dashboard'}
            </h1>
            <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-700 border border-slate-200">
              Base: {baseCurrency}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">{group?.description}</p>
        </div>

        <div className="flex items-center gap-2">
          {pendingReviewsCount > 0 && (
            <button
              onClick={() => onNavigate('review-queue')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-colors"
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
              <span>{pendingReviewsCount} AI items need review</span>
            </button>
          )}
          <button
            onClick={() => onNavigate('optimizer')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors shadow-xs"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Optimize Settlement</span>
          </button>
        </div>
      </div>

      {/* Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Total Group Expenses</span>
            <DollarSign className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mono-numeric">
            {totalExpenses} <span className="text-sm font-normal text-slate-500">{baseCurrency}</span>
          </div>
          <div className="text-[11px] text-slate-500">Sum of all approved expenses</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Active Participants</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mono-numeric">
            {balances.length} <span className="text-sm font-normal text-slate-500">Members</span>
          </div>
          <div className="text-[11px] text-slate-500">Alex (EUR), Sam (USD), John (JPY)</div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Accounting Equilibrium</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-emerald-700 mono-numeric flex items-center gap-1.5">
            {isBalanced ? 'Balanced' : 'Discrepant'}
          </div>
          <div className="text-[11px] text-slate-500">
            Zero-sum invariant: ∑(Net) = {balanceSummary?.discrepancyBase || '0.00'} {baseCurrency}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="text-xs text-slate-500 font-medium flex items-center justify-between">
            <span>Pending AI Verification</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 mono-numeric">
            {pendingReviewsCount} <span className="text-sm font-normal text-slate-500">in queue</span>
          </div>
          <div className="text-[11px] text-slate-500">Requires human sign-off</div>
        </div>
      </div>

      {/* Net Balances Overview & Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Balances Table */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Participant Net Balances</h3>
              <p className="text-xs text-slate-500">Exact calculations in group base & preferred currencies</p>
            </div>
            <span className="text-[11px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              Verified Zero-Sum
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-200/60 text-slate-500 uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Participant</th>
                  <th className="py-2.5 px-4">Preferred Currency</th>
                  <th className="py-2.5 px-4">Total Paid (Base)</th>
                  <th className="py-2.5 px-4">Total Owed (Base)</th>
                  <th className="py-2.5 px-4 text-right">Net Balance (Base)</th>
                  <th className="py-2.5 px-4 text-right">In Preferred</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balances.map((b) => {
                  const netDec = parseFloat(b.netInBase);
                  const isPositive = netDec > 0;
                  const isNegative = netDec < 0;

                  return (
                    <tr key={b.memberId} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900">{b.memberName}</td>
                      <td className="py-3 px-4">
                        <span className="font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                          {b.preferredCurrency}
                        </span>
                      </td>
                      <td className="py-3 px-4 mono-numeric text-slate-600">
                        {b.totalPaidBase} {baseCurrency}
                      </td>
                      <td className="py-3 px-4 mono-numeric text-slate-600">
                        {b.totalOwedBase} {baseCurrency}
                      </td>
                      <td className="py-3 px-4 text-right mono-numeric font-bold">
                        <span
                          className={
                            isPositive
                              ? 'text-emerald-700'
                              : isNegative
                              ? 'text-rose-600'
                              : 'text-slate-600'
                          }
                        >
                          {isPositive ? '+' : ''}
                          {b.netInBase} {baseCurrency}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right mono-numeric text-slate-700 font-medium">
                        {isPositive ? '+' : ''}
                        {b.netInPreferred} {b.preferredCurrency}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Balance Distribution Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Net Exposure Distribution</h3>
            <p className="text-xs text-slate-500 mb-4">Creditors (positive) vs Debtors (negative)</p>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: any) => [`${value} ${baseCurrency}`, 'Net Balance']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="net" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.net >= 0 ? '#059669' : '#e11d48'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-emerald-600"></span> To Receive
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded bg-rose-600"></span> To Pay
            </span>
          </div>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div
          onClick={() => onNavigate('optimizer')}
          className="bg-white hover:bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 cursor-pointer transition-all shadow-xs flex items-center justify-between group"
        >
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Scale className="w-4 h-4 text-indigo-600" />
              Settlement Optimizer
            </div>
            <p className="text-[11px] text-slate-500">Compare Min Transfers vs Min Cost strategies</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
        </div>

        <div
          onClick={() => onNavigate('reconciliation')}
          className="bg-white hover:bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 cursor-pointer transition-all shadow-xs flex items-center justify-between group"
        >
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <GitCompare className="w-4 h-4 text-indigo-600" />
              Payment Reconciliation
            </div>
            <p className="text-[11px] text-slate-500">Ledger vs PayPal quote vs verified capture outcome</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
        </div>

        <div
          onClick={() => onNavigate('ledger')}
          className="bg-white hover:bg-slate-50/80 border border-slate-200/80 rounded-xl p-4 cursor-pointer transition-all shadow-xs flex items-center justify-between group"
        >
          <div className="space-y-1">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-slate-700" />
              Financial Ledger
            </div>
            <p className="text-[11px] text-slate-500">Immutable transaction log with rate sources</p>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-slate-900 group-hover:translate-x-1 transition-all" />
        </div>
      </div>
    </div>
  );
};
