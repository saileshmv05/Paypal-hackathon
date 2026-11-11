import React, { useState } from 'react';
import {
  CheckSquare,
  AlertTriangle,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Edit2,
  UserCheck,
} from 'lucide-react';
import { Group, AIExtractionItem } from '../types';
import { approveAIItem, rejectAIItem } from '../api/client';

interface ReviewQueuePageProps {
  group: Group | null;
  items: AIExtractionItem[];
  onRefresh: () => void;
  onNavigateToLedger: () => void;
}

export const ReviewQueuePage: React.FC<ReviewQueuePageProps> = ({
  group,
  items,
  onRefresh,
  onNavigateToLedger,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPayerId, setEditPayerId] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editCurrency, setEditCurrency] = useState('EUR');
  const [editDescription, setEditDescription] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingItems = items.filter((i) => i.status === 'PENDING_REVIEW');
  const members = group?.members || [];

  const handleStartEdit = (item: AIExtractionItem) => {
    setEditingId(item.id);
    setEditPayerId(item.payer_id || item.payerId || members[0]?.id || '');
    setEditAmount(item.amount || '50.00');
    setEditCurrency(item.currency || 'EUR');
    setEditDescription(item.description);
  };

  const handleApprove = async (item: AIExtractionItem) => {
    if (!group) return;
    setLoadingId(item.id);
    setError(null);

    try {
      const isEditing = editingId === item.id;
      await approveAIItem(group.id, item.id, {
        payerId: isEditing ? editPayerId : item.payer_id || item.payerId,
        amount: isEditing ? editAmount : item.amount,
        currency: isEditing ? editCurrency : item.currency,
        description: isEditing ? editDescription : item.description,
      });
      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleReject = async (itemId: string) => {
    if (!group) return;
    setLoadingId(itemId);
    setError(null);

    try {
      await rejectAIItem(group.id, itemId);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Expense Verification Queue</h1>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              Human-in-the-Loop Safeguard
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Every transaction extracted by AI requires human verification before entering the immutable financial ledger.
          </p>
        </div>

        <button
          onClick={onNavigateToLedger}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-medium transition-colors"
        >
          <span>View Approved Financial Ledger</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
      )}

      {/* Queue List */}
      {pendingItems.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center space-y-3 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto border border-emerald-100">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Queue is Clear</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            All AI-extracted items have been reviewed and approved or dismissed. New chat logs or receipts will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingItems.map((item) => {
            const isEditing = editingId === item.id;
            const isPromise = item.classification === 'PAYMENT_PROMISE';
            const isDisputed = item.classification === 'UNRESOLVED';
            const isRepayment = item.classification === 'REPAYMENT';

            return (
              <div
                key={item.id}
                className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        item.classification === 'CONFIRMED_EXPENSE'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : isRepayment
                          ? 'bg-sky-50 text-sky-800 border border-sky-200'
                          : isPromise
                          ? 'bg-purple-50 text-purple-800 border border-purple-200'
                          : 'bg-rose-50 text-rose-800 border border-rose-200'
                      }`}
                    >
                      {item.classification.replace('_', ' ')}
                    </span>

                    <span className="text-xs font-bold text-slate-900">{item.description}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-slate-400 font-mono">
                      Confidence: {Math.round((item.confidence_score ?? item.confidenceScore ?? 0.8) * 100)}%
                    </span>
                    {item.amount && (
                      <span className="font-bold text-slate-900 text-sm mono-numeric px-2.5 py-0.5 bg-slate-100 rounded">
                        {item.amount} {item.currency || 'EUR'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Source Message & AI Reasoning */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">Evidence Source:</span>
                    <div className="p-2.5 rounded-lg bg-slate-50 font-mono text-slate-700 text-[11px] border border-slate-100">
                      {item.source_text || item.sourceText}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-slate-400 font-medium">Extraction Rationale:</span>
                    <p className="text-slate-600 text-xs leading-relaxed">{item.explanation}</p>
                  </div>
                </div>

                {/* Classification Warning / Guidance */}
                {isPromise && (
                  <div className="p-3 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-start gap-2.5">
                    <Clock className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Payment Promise Notice:</strong> Group member expressed an intention to pay ("I will send"), not an executed payment.
                      Do not approve into financial balances until payment has physically completed.
                    </div>
                  </div>
                )}

                {isDisputed && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <strong>Contested Obligation:</strong> Another participant objected to this expense.
                      Ensure payer responsibility is resolved before approving.
                    </div>
                  </div>
                )}

                {/* Edit Form if Triggered */}
                {isEditing && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
                    <div className="font-bold text-slate-900">Edit Details Before Approval</div>
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-slate-600 mb-1">Payer</label>
                        <select
                          value={editPayerId}
                          onChange={(e) => setEditPayerId(e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                        >
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.name} ({m.country})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1">Amount</label>
                        <input
                          type="text"
                          value={editAmount}
                          onChange={(e) => setEditAmount(e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1">Currency</label>
                        <select
                          value={editCurrency}
                          onChange={(e) => setEditCurrency(e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg bg-white"
                        >
                          <option value="EUR">EUR (€)</option>
                          <option value="USD">USD ($)</option>
                          <option value="GBP">GBP (£)</option>
                          <option value="INR">INR (₹)</option>
                          <option value="JPY">JPY (¥)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-slate-600 mb-1">Description</label>
                        <input
                          type="text"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full p-2 border border-slate-200 rounded-lg"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <button
                    onClick={() => (isEditing ? setEditingId(null) : handleStartEdit(item))}
                    className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-medium"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>{isEditing ? 'Cancel Edit' : 'Edit Fields'}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleReject(item.id)}
                      disabled={loadingId === item.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 font-medium transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>

                    <button
                      onClick={() => handleApprove(item)}
                      disabled={loadingId === item.id}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors shadow-xs disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{loadingId === item.id ? 'Committing...' : 'Approve to Financial Ledger'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
