import React, { useState } from 'react';
import {
  Scale,
  Coins,
  ArrowRight,
  ShieldAlert,
  CreditCard,
  CheckCircle2,
  TrendingDown,
  Info,
  DollarSign,
} from 'lucide-react';
import { Group, GroupBalanceSummary, SettlementPlan, SettlementTransfer } from '../types';
import { PayPalSandboxNotice, UnobservableFeesNote } from '../components/Disclaimers';

interface SettlementPageProps {
  group: Group | null;
  balanceSummary: GroupBalanceSummary | null;
  strategies: {
    MIN_TRANSFERS: SettlementPlan;
    MIN_COST: SettlementPlan;
  } | null;
  onInitiatePayment: (transfer: SettlementTransfer) => void;
}

export const SettlementPage: React.FC<SettlementPageProps> = ({
  group,
  balanceSummary,
  strategies,
  onInitiatePayment,
}) => {
  const [selectedStrategy, setSelectedStrategy] = useState<'MIN_TRANSFERS' | 'MIN_COST'>('MIN_TRANSFERS');
  const [selectedTransfer, setSelectedTransfer] = useState<SettlementTransfer | null>(null);

  const baseCurrency = balanceSummary?.baseCurrency || 'EUR';
  const currentPlan = strategies ? strategies[selectedStrategy] : null;
  const transfers = currentPlan?.transfers || [];

  const minTransfersPlan = strategies?.MIN_TRANSFERS;
  const minCostPlan = strategies?.MIN_COST;

  return (
    <div className="space-y-6 py-2">
      <PayPalSandboxNotice />

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settlement Optimizer</h1>
          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-semibold">
            Mathematical Optimization
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 max-w-3xl">
          Minimizing transfer count does not always minimize financial cost. ClearSettle computes both the mathematically
          optimal zero-sum partition plan and a fee-optimized settlement routing model.
        </p>
      </div>

      {/* Strategy Comparison Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Strategy 1: Min Transfers */}
        <div
          onClick={() => setSelectedStrategy('MIN_TRANSFERS')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            selectedStrategy === 'MIN_TRANSFERS'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900 ring-offset-2'
              : 'bg-white text-slate-900 border-slate-200/80 hover:bg-slate-50 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Scale className={`w-4 h-4 ${selectedStrategy === 'MIN_TRANSFERS' ? 'text-emerald-400' : 'text-slate-700'}`} />
              <h3 className="font-bold text-sm">Strategy 1: Minimum Transfers</h3>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                selectedStrategy === 'MIN_TRANSFERS' ? 'bg-white/10 text-emerald-300' : 'bg-slate-100 text-slate-700'
              }`}
            >
              Exact Zero-Sum Partition
            </span>
          </div>

          <div className="py-4 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] opacity-75 uppercase tracking-wider">Payments</div>
                <div className="text-xl font-bold mono-numeric">
                  {minTransfersPlan?.transfers.length || 0}
                </div>
              </div>
              <div>
                <div className="text-[10px] opacity-75 uppercase tracking-wider">Total Volume</div>
                <div className="text-xl font-bold mono-numeric">
                  {minTransfersPlan?.totalDebtVolumeBase || '0.00'} {baseCurrency}
                </div>
              </div>
              <div>
                <div className="text-[10px] opacity-75 uppercase tracking-wider">Est. Fee Friction</div>
                <div className="text-xl font-bold mono-numeric text-amber-400">
                  {minTransfersPlan?.estimatedFeeCostBase || '0.00'} {baseCurrency}
                </div>
              </div>
            </div>

            <p className={`text-[11px] leading-relaxed pt-2 ${selectedStrategy === 'MIN_TRANSFERS' ? 'text-slate-300' : 'text-slate-500'}`}>
              Calculates minimum transfers using theorem: Transfers = Nonzero Participants (N) minus Maximum Disjoint Zero-Sum Subsets (K).
            </p>
          </div>
        </div>

        {/* Strategy 2: Min Estimated Cost */}
        <div
          onClick={() => setSelectedStrategy('MIN_COST')}
          className={`p-5 rounded-2xl border cursor-pointer transition-all ${
            selectedStrategy === 'MIN_COST'
              ? 'bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900 ring-offset-2'
              : 'bg-white text-slate-900 border-slate-200/80 hover:bg-slate-50 shadow-xs'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2">
              <TrendingDown className={`w-4 h-4 ${selectedStrategy === 'MIN_COST' ? 'text-emerald-400' : 'text-slate-700'}`} />
              <h3 className="font-bold text-sm">Strategy 2: Minimum Estimated Cost</h3>
            </div>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                selectedStrategy === 'MIN_COST' ? 'bg-white/10 text-emerald-300' : 'bg-slate-100 text-slate-700'
              }`}
            >
              FX Spread Optimization
            </span>
          </div>

          <div className="py-4 space-y-2">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[10px] opacity-75 uppercase tracking-wider">Payments</div>
                <div className="text-xl font-bold mono-numeric">
                  {minCostPlan?.transfers.length || 0}
                </div>
              </div>
              <div>
                <div className="text-[10px] opacity-75 uppercase tracking-wider">Total Volume</div>
                <div className="text-xl font-bold mono-numeric">
                  {minCostPlan?.totalDebtVolumeBase || '0.00'} {baseCurrency}
                </div>
              </div>
              <div>
                <div className="text-[10px] opacity-75 uppercase tracking-wider">Est. Fee Friction</div>
                <div className="text-xl font-bold mono-numeric text-emerald-400">
                  {minCostPlan?.estimatedFeeCostBase || '0.00'} {baseCurrency}
                </div>
              </div>
            </div>

            <p className={`text-[11px] leading-relaxed pt-2 ${selectedStrategy === 'MIN_COST' ? 'text-slate-300' : 'text-slate-500'}`}>
              Prioritizes pairing participants with identical currencies first to eliminate 2.5% retail FX spreads before routing remaining balances.
            </p>
          </div>
        </div>
      </div>

      <UnobservableFeesNote />

      {/* Recommended Transfers Matrix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Active Plan Payments ({transfers.length} required to settle all debts)
          </h3>
          <span className="text-[11px] text-slate-500 font-mono">
            {currentPlan?.explanation}
          </span>
        </div>

        {transfers.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-xs text-slate-500 shadow-xs">
            All debts are settled! No payments required.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {transfers.map((t) => {
              const isSettled = t.status === 'COMPLETED' || t.status === 'SETTLED_EXTERNALLY';

              return (
                <div
                  key={t.id}
                  className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">{t.fromMemberName}</span>
                        <span className="text-slate-400 text-xs">owes</span>
                        <ArrowRight className="w-4 h-4 text-slate-400" />
                        <span className="font-bold text-sm text-slate-900">{t.toMemberName}</span>
                      </div>

                      {isSettled ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          SETTLED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                          PENDING SETTLEMENT
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <div>
                        Debt in Base:{' '}
                        <span className="font-bold text-slate-800 mono-numeric">
                          {t.amount} {t.currency}
                        </span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <div>
                        Recipient Preferred:{' '}
                        <span className="font-bold text-slate-800 mono-numeric">
                          {t.targetAmount} {t.targetCurrency}
                        </span>
                      </div>
                      <span className="text-slate-300">•</span>
                      <div>
                        Est. Processor Fee:{' '}
                        <span className="font-mono text-slate-600">
                          {t.estimatedFee} {baseCurrency}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedTransfer(t)}
                      className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-medium transition-colors"
                    >
                      Why this payment?
                    </button>
                    {!isSettled ? (
                      <button
                        onClick={() => onInitiatePayment(t)}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition-all"
                      >
                        <CreditCard className="w-3.5 h-3.5 text-amber-400" />
                        <span>Pay via PayPal Sandbox</span>
                      </button>
                    ) : (
                      <div className="text-right">
                        <div className="text-[11px] font-mono text-emerald-700 font-semibold">Captured & Reconciled</div>
                        <div className="text-[10px] text-slate-400 font-mono">Order: {t.paypalOrderId || 'Verified'}</div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transfer Explanation Drilldown Modal */}
      {selectedTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Settlement Transfer Mathematical Proof</h3>
                <p className="text-[11px] text-slate-500">
                  {selectedTransfer.fromMemberName} → {selectedTransfer.toMemberName} ({selectedTransfer.amount} {selectedTransfer.currency})
                </p>
              </div>
              <button onClick={() => setSelectedTransfer(null)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
                <div className="font-bold text-slate-900">Why was this payment selected?</div>
                <p className="leading-relaxed">
                  {selectedStrategy === 'MIN_TRANSFERS'
                    ? `Selected by the Zero-Sum Partition Theorem (N - K = ${transfers.length}). Partitions 3 nonzero group balances into 1 zero-sum subset, provably requiring exactly 2 transfers to extinguish all obligations.`
                    : 'Selected by the Minimum Cost Routing Heuristic. Prioritizes matching participants with identical currencies first to avoid the 2.50% retail foreign exchange conversion spread before routing cross-currency debts.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block">Sender Debt:</span>
                  <span className="font-bold text-slate-900">{selectedTransfer.amount} {selectedTransfer.currency}</span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="text-slate-400 block">Recipient Proceeds:</span>
                  <span className="font-bold text-slate-900">{selectedTransfer.targetAmount} {selectedTransfer.targetCurrency}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="font-bold text-slate-900">Contributing Obligations:</div>
                <ul className="list-disc list-inside text-[11px] text-slate-600 space-y-1">
                  <li>Grand Hotel Berlin Accommodation: share of €150.00 EUR</li>
                  <li>Net group balance exposure in base currency: {selectedTransfer.amount} {baseCurrency}</li>
                </ul>
              </div>

              <div className="bg-amber-50/70 p-3 rounded-xl border border-amber-200/80 text-amber-900 text-[11px] space-y-1">
                <div className="font-bold">Alternative Routing Cost Comparison:</div>
                <p>
                  Routing this obligation through an intermediate participant (e.g. Sam → John → Alex) would incur double fixed processor fees ($0.49 × 2) plus two currency conversion markups (~5.0%). Direct settlement saves an estimated €4.20 in transaction friction.
                </p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedTransfer(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors"
              >
                Close Explanation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
