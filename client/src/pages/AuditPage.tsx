import React, { useState } from 'react';
import {
  History,
  Download,
  FileSpreadsheet,
  FileCode,
  ShieldCheck,
  ShieldAlert,
  User,
  Clock,
  ArrowRight,
  Hash,
} from 'lucide-react';
import { Group, AuditEvent } from '../types';
import { verifyAuditChain } from '../api/client';

interface AuditPageProps {
  group: Group | null;
  events: AuditEvent[];
}

export const AuditPage: React.FC<AuditPageProps> = ({ group, events }) => {
  const groupId = group?.id || 'group-intl-trip-2026';
  const [verificationResult, setVerificationResult] = useState<{
    isValid: boolean;
    totalEvents: number;
    verifiedAt: string;
    errors: string[];
  } | null>(null);
  const [verifying, setVerifying] = useState(false);

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await verifyAuditChain(groupId);
      setVerificationResult(res);
    } catch (err) {
      alert('Verification failed');
    } finally {
      setVerifying(false);
    }
  };

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
              Tamper-Evident SHA-256 Chain
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Cryptographically linked log of all financial decisions, exchange rates, and PayPal captures. Each block contains the SHA-256 hash of its predecessor.
          </p>
        </div>

        {/* Action CTAs */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleVerifyChain}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shadow-2xs"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>{verifying ? 'Verifying Hashes...' : 'Verify Cryptographic Chain'}</span>
          </button>

          <button
            onClick={handleDownloadCSV}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-medium transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleDownloadJSON}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors shadow-xs"
          >
            <FileCode className="w-3.5 h-3.5 text-indigo-300" />
            <span>Export JSON</span>
          </button>
        </div>
      </div>

      {/* Cryptographic Chain Verification Result Banner */}
      {verificationResult && (
        <div
          className={`p-4 rounded-xl border flex items-start gap-3 text-xs ${
            verificationResult.isValid
              ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          {verificationResult.isValid ? (
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          ) : (
            <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          )}
          <div className="space-y-1">
            <div className="font-bold text-sm">
              {verificationResult.isValid
                ? 'Cryptographic Chain Valid & Intact'
                : 'Tampering or Broken Chain Linkage Detected!'}
            </div>
            <p className="text-[11px] leading-relaxed">
              {verificationResult.isValid
                ? `Successfully recalculated SHA-256 hashes across all ${verificationResult.totalEvents} blocks. Previous block links match perfectly. Zero records were modified, deleted, or reordered.`
                : `Security alert: Verification failed with ${verificationResult.errors.length} issue(s): ${verificationResult.errors.join('; ')}`}
            </p>
            <div className="font-mono text-[10px] text-slate-500 pt-0.5">
              Verified at: {verificationResult.verifiedAt}
            </div>
          </div>
        </div>
      )}

      {/* Events Timeline */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-900">Chronological Event Log ({events.length} blocks)</span>
          <span className="text-slate-400 font-mono text-[11px]">Tamper-Evident SHA-256 Ledger</span>
        </div>

        {events.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">No events logged yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {events.map((evt, idx) => (
              <div key={evt.id} className="p-4 hover:bg-slate-50/60 transition-colors space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      #{events.length - idx} {evt.event_type}
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

                {/* Cryptographic Hash Metadata */}
                {evt.hash && (
                  <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-1">
                      <Hash className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-500 font-medium">Hash:</span>
                      <span className="text-slate-700">{evt.hash.slice(0, 16)}...{evt.hash.slice(-8)}</span>
                    </div>
                    {evt.prev_hash && (
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500 font-medium">Prev:</span>
                        <span className="text-slate-600">{evt.prev_hash.slice(0, 12)}...</span>
                      </div>
                    )}
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

