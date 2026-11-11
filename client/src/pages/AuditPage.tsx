import React from 'react';
import {
  History,
  Download,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  User,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Group, AuditEvent } from '../types';

interface AuditPageProps {
  group: Group | null;
  events: AuditEvent[];
}

export const AuditPage: React.FC<AuditPageProps> = ({ group, events }) => {
  const groupId = group?.id || 'group-intl-trip-2026';

  const handleDownloadCSV = () => {
    window.open(`/api/groups/${groupId}/export/csv`, '_blank');
  };

  const handleDownloadJSON = () => {
    window.open(`/api/groups/${groupId}/export/json`, '_blank');
  };

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Trail & Reports</h1>
            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-semibold">
              Full Financial Provenance
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Immutable log of all expense approvals, exchange rate fixings, participant balance modifications, and PayPal sandbox captures.
          </p>
        </div>

        {/* Downloadable Reports CTAs */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadCSV}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-medium transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV Report</span>
          </button>

          <button
            onClick={handleDownloadJSON}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors shadow-xs"
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-300" />
            <span>Export Audit JSON</span>
          </button>
        </div>
      </div>

      {/* Events Timeline */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-900">Chronological Event Log ({events.length} records)</span>
          <span className="text-slate-400 font-mono text-[11px]">Append-Only Ledger</span>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No events logged yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((evt) => (
              <div key={evt.id} className="p-4 hover:bg-slate-50/60 transition-colors space-y-1.5 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      {evt.event_type}
                    </span>
                    <span className="font-semibold text-slate-900">{evt.description}</span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400 font-mono">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-400" />
                      {evt.actor}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {evt.created_at?.replace('T', ' ').split('.')[0]}
                    </span>
                  </div>
                </div>

                {evt.metadata && (
                  <div className="p-2 rounded bg-slate-50 font-mono text-[11px] text-slate-600 border border-slate-100 overflow-x-auto">
                    {evt.metadata}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
