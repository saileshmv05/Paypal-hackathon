import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  ShieldCheck,
  FileText,
  Calendar,
  ExternalLink,
  Coins,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Group, Expense } from '../types';
import { createExpense } from '../api/client';

interface LedgerPageProps {
  group: Group | null;
  expenses: Expense[];
  onRefresh: () => void;
}

export const LedgerPage: React.FC<LedgerPageProps> = ({ group, expenses, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Form states
  const [payerId, setPayerId] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Accommodation');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [splitIds, setSplitIds] = useState<string[]>([]);
  const [evidenceRef, setEvidenceRef] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = group?.members || [];
  const baseCurrency = group?.baseCurrency || 'EUR';

  const handleOpenAddModal = () => {
    if (members.length > 0) {
      setPayerId(members[0].id);
      setSplitIds(members.map((m) => m.id)); // Default all split
    }
    setShowAddModal(true);
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;
    setLoading(true);
    setError(null);

    try {
      await createExpense(group.id, {
        payerId,
        description,
        category,
        originalAmount: amount,
        originalCurrency: currency,
        splitMemberIds: splitIds,
        evidenceType: evidenceRef ? 'RECEIPT' : 'MANUAL',
        evidenceRef,
      });
      setShowAddModal(false);
      setDescription('');
      setAmount('');
      setEvidenceRef('');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleSplit = (id: string) => {
    if (splitIds.includes(id)) {
      if (splitIds.length > 1) {
        setSplitIds(splitIds.filter((mId) => mId !== id));
      }
    } else {
      setSplitIds([...splitIds, id]);
    }
  };

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Multicurrency Financial Ledger</h1>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-xs font-mono">
              Immutable
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Deterministic accounting record. Every transaction records original currency, reference exchange rate,
            provenance source (ECB benchmark), timestamp, and verified participant split breakdown.
          </p>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Manual Expense</span>
        </button>
      </div>

      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/75 border-b border-slate-200/60 text-slate-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Description</th>
                <th className="py-3 px-4">Payer</th>
                <th className="py-3 px-4 text-right">Original Amount</th>
                <th className="py-3 px-4 text-right">Base Amount ({baseCurrency})</th>
                <th className="py-3 px-4">Rate & Provenance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Splits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((exp) => {
                const isExpanded = expandedId === exp.id;
                const isForeign = exp.original_currency !== baseCurrency;

                return (
                  <React.Fragment key={exp.id}>
                    <tr
                      className="hover:bg-slate-50/60 transition-colors cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : exp.id)}
                    >
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                        {exp.created_at.split('T')[0]}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{exp.description}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                            {exp.category}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-800">{exp.payer_name || 'Member'}</td>
                      <td className="py-3 px-4 text-right mono-numeric font-bold text-slate-900">
                        {exp.original_amount}{' '}
                        <span className="font-mono text-[11px] font-semibold text-slate-500">
                          {exp.original_currency}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right mono-numeric font-bold text-slate-900">
                        {exp.base_amount} <span className="font-mono text-[11px] text-slate-500">{baseCurrency}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {isForeign ? (
                          <div className="text-[11px] leading-tight">
                            <div className="font-mono font-semibold text-slate-800">
                              1 {exp.original_currency} = {parseFloat(exp.exchange_rate).toFixed(6)} {baseCurrency}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">{exp.rate_source}</div>
                          </div>
                        ) : (
                          <span className="text-[11px] font-mono text-slate-400">Parity (1.0)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          APPROVED
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button className="text-slate-400 hover:text-slate-600">
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>

                    {/* Expanded Split Breakdown */}
                    {isExpanded && (
                      <tr className="bg-slate-50/80">
                        <td colSpan={8} className="py-3 px-6">
                          <div className="space-y-2">
                            <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                              <span>Verified Participant Allocation (Zero Cent Rounding Guarantee):</span>
                              {exp.evidence_ref && (
                                <span className="font-mono text-[10px] text-slate-500 font-normal">
                                  Evidence: {exp.evidence_ref}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              {exp.splits?.map((split) => (
                                <div
                                  key={split.id}
                                  className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs flex items-center justify-between shadow-2xs"
                                >
                                  <span className="font-semibold text-slate-800">{split.member_name || 'Member'}</span>
                                  <div className="text-right mono-numeric">
                                    <div className="font-bold text-slate-900">
                                      {split.share_amount} {exp.original_currency}
                                    </div>
                                    <div className="text-[10px] text-slate-400">
                                      Base: {split.share_base_amount} {baseCurrency}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Manual Expense Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Record New Expense</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
            )}

            <form onSubmit={handleCreateExpense} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shinkansen Bullet Train Tickets"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Payer</label>
                  <select
                    value={payerId}
                    onChange={(e) => setPayerId(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    {members.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.country})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Accommodation">Accommodation</option>
                    <option value="Food & Dining">Food & Dining</option>
                    <option value="Transit">Transit</option>
                    <option value="Activities">Activities</option>
                    <option value="Supplies">Supplies</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Original Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 150.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-white font-mono"
                  >
                    <option value="EUR">EUR (€) - Euro</option>
                    <option value="USD">USD ($) - US Dollar</option>
                    <option value="GBP">GBP (£) - British Pound</option>
                    <option value="INR">INR (₹) - Indian Rupee</option>
                    <option value="JPY">JPY (¥) - Japanese Yen</option>
                  </select>
                </div>
              </div>

              {/* Split Participants */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Split Participants ({splitIds.length} selected)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {members.map((m) => {
                    const selected = splitIds.includes(m.id);
                    return (
                      <button
                        type="button"
                        key={m.id}
                        onClick={() => toggleSplit(m.id)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          selected
                            ? 'bg-slate-900 text-white border-slate-900 font-semibold'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div>{m.name}</div>
                        <div className="text-[10px] opacity-75 font-normal">{m.preferredCurrency}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Receipt / Invoice Evidence Reference</label>
                <input
                  type="text"
                  placeholder="e.g. receipt_shinkansen_2026.pdf"
                  value={evidenceRef}
                  onChange={(e) => setEvidenceRef(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg font-mono text-slate-700"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {loading ? 'Recording...' : 'Commit Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
