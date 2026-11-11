import React, { useState } from 'react';
import { UserPlus, Users, Globe, Mail, DollarSign, PlusCircle } from 'lucide-react';
import { Group, GroupBalanceSummary } from '../types';
import { addMember } from '../api/client';

interface GroupPageProps {
  group: Group | null;
  balanceSummary: GroupBalanceSummary | null;
  onRefresh: () => void;
}

export const GroupPage: React.FC<GroupPageProps> = ({ group, balanceSummary, onRefresh }) => {
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [country, setCountry] = useState('Germany');
  const [currency, setCurrency] = useState('EUR');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = group?.members || [];
  const baseCurrency = group?.baseCurrency || 'EUR';

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;
    setLoading(true);
    setError(null);

    try {
      await addMember(group.id, {
        name,
        country,
        preferredCurrency: currency,
        email: email || `${name.toLowerCase()}@example.com`,
      });
      setShowAddModal(false);
      setName('');
      setEmail('');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Group Management</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage international travel group members and their preferred settlement currencies.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors shadow-xs"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Add Participant</span>
        </button>
      </div>

      {/* Participants Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {members.map((m) => {
          const balance = balanceSummary?.balances.find((b) => b.memberId === m.id);
          const netBase = balance ? parseFloat(balance.netInBase) : 0;
          const isCreditor = netBase > 0;
          const isDebtor = netBase < 0;

          return (
            <div
              key={m.id}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700 text-sm">
                      {m.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{m.name}</h3>
                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <Globe className="w-3 h-3 text-slate-400" />
                        <span>{m.country}</span>
                      </div>
                    </div>
                  </div>

                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {m.preferredCurrency}
                  </span>
                </div>

                <div className="text-xs text-slate-500 flex items-center gap-1.5 pt-1">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span className="truncate">{m.email}</span>
                </div>
              </div>

              {/* Financial Status Box */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Net Balance</div>
                  <div className="text-sm font-bold mono-numeric">
                    <span className={isCreditor ? 'text-emerald-700' : isDebtor ? 'text-rose-600' : 'text-slate-600'}>
                      {isCreditor ? '+' : ''}
                      {balance?.netInBase || '0.00'} {baseCurrency}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Preferred Cur.</div>
                  <div className="text-xs font-medium text-slate-700 mono-numeric">
                    {isCreditor ? '+' : ''}
                    {balance?.netInPreferred || '0.00'} {m.preferredCurrency}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Participant Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add Group Participant</h3>
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

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Participant Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Maria"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. United Kingdom"
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Preferred Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="INR">INR (₹)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  placeholder="maria@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  {loading ? 'Adding...' : 'Add Participant'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
