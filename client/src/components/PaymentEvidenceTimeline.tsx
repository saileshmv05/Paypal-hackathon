import React from 'react';
import {
  CheckCircle2,
  Clock,
  ShieldCheck,
  CreditCard,
  Layers,
  ArrowRight,
  DollarSign,
  AlertTriangle,
  FileText,
  Sparkles,
} from 'lucide-react';
import { ReconciliationRecord } from '../types';

interface PaymentEvidenceTimelineProps {
  reconciliation: ReconciliationRecord;
}

export const PaymentEvidenceTimeline: React.FC<PaymentEvidenceTimelineProps> = ({ reconciliation: rec }) => {
  const isCompleted = rec.status === 'RECONCILIATION_COMPLETE' || rec.status === 'CAPTURE_CONFIRMED';
  const isFailed = rec.status === 'CAPTURE_FAILED';
  const isManual = rec.provider === 'MANUAL';

  const steps = [
    {
      title: '1. Financial Obligation Created',
      subtitle: `${rec.ledger_original_amount} ${rec.ledger_original_currency}`,
      description: 'Calculated by zero-sum settlement optimizer or issued business invoice in local currency.',
      icon: Layers,
      status: 'complete',
      timestamp: rec.created_at ? new Date(rec.created_at).toLocaleTimeString() : 'Recorded',
      badge: 'LEDGER',
      badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    {
      title: '2. Human Review & Payment Initiation',
      subtitle: rec.quote_amount ? `Quoted: ${rec.quote_amount} ${rec.quote_currency}` : 'Direct Provider Initiation',
      description: 'Reviewed by organizer/business user. Disclaimers verified; payment order created server-side.',
      icon: ShieldCheck,
      status: 'complete',
      timestamp: rec.quote_expires_at ? 'Quote checked' : 'Pre-capture binding',
      badge: rec.quote_amount ? 'QUOTE' : 'INITIATED',
      badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    },
    {
      title: isManual ? '3. Offline Peer Settlement' : '3. PayPal Orders v2 Buyer Checkout',
      subtitle: isManual ? 'External Bank / Cash' : `Order ID: ${rec.transaction_id || 'Pending'}`,
      description: isManual
        ? 'Settlement completed directly between peers outside PayPal platform.'
        : 'Buyer redirected to PayPal sandbox checkout; authorized merchant payment.',
      icon: CreditCard,
      status: isCompleted ? 'complete' : isFailed ? 'failed' : 'pending',
      timestamp: rec.capture_timestamp ? new Date(rec.capture_timestamp).toLocaleTimeString() : 'Authorizing',
      badge: isManual ? 'MANUAL' : 'PAYPAL-CHECKOUT',
      badgeClass: isManual ? 'bg-amber-100 text-amber-800 border-amber-200' : 'bg-sky-100 text-sky-800 border-sky-200',
    },
    {
      title: '4. Provider Capture & Fee Auditing',
      subtitle: rec.capture_gross_amount
        ? `Captured: ${rec.capture_gross_amount} ${rec.capture_gross_currency} (Fee: ${rec.capture_fee_amount || '0.00'} ${rec.capture_fee_currency || ''})`
        : 'Capture Pending',
      description: isManual
        ? 'Manual payment declared by group organizer. Unobservable external fees may apply.'
        : 'Authoritative PayPal REST API capture verified server-side. Merchant transaction processing fee audited from seller breakdown.',
      icon: DollarSign,
      status: isCompleted ? 'complete' : isFailed ? 'failed' : 'pending',
      timestamp: rec.capture_timestamp || 'Pending',
      badge: rec.capture_provenance || 'PAYPAL-CAPTURE',
      badgeClass: rec.capture_provenance === 'PAYPAL-CAPTURE' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200',
    },
    {
      title: '5. Reconciliation & Proceeds Settlement',
      subtitle: rec.capture_net_amount
        ? `Net Proceeds: ${rec.capture_net_amount} ${rec.capture_net_currency} • Status: ${rec.match_status || 'MATCHED'}`
        : 'Pending Reconciliation',
      description: rec.decisionTrace?.summary || rec.explanation,
      icon: Sparkles,
      status: isCompleted ? 'complete' : isFailed ? 'failed' : 'pending',
      timestamp: 'Reconciled',
      badge: rec.match_status || 'MATCHED',
      badgeClass:
        rec.match_status === 'MATCHED'
          ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
          : rec.match_status === 'UNDERPAID'
          ? 'bg-amber-100 text-amber-800 border-amber-200'
          : 'bg-indigo-100 text-indigo-800 border-indigo-200',
    },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-900 tracking-tight">Payment Evidence Timeline</h3>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              End-to-End Audit
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cryptographic and financial audit trace from original obligation to final net proceeds credited.
          </p>
        </div>
        <div className="text-right">
          <span className="text-[11px] font-mono text-slate-400 block">Transaction Reference</span>
          <span className="text-xs font-mono font-bold text-slate-800">{rec.transaction_id || rec.id.slice(0, 12)}</span>
        </div>
      </div>

      <div className="relative pl-6 sm:pl-8 space-y-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isDone = step.status === 'complete';
          const isCurrent = step.status === 'pending';
          const isFail = step.status === 'failed';

          return (
            <div key={idx} className="relative group">
              {/* Timeline marker icon */}
              <div
                className={`absolute -left-6 sm:-left-8 top-0.5 w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center border-2 bg-white transition-all ${
                  isDone
                    ? 'border-emerald-500 text-emerald-600 shadow-xs'
                    : isFail
                    ? 'border-rose-500 text-rose-600'
                    : 'border-slate-300 text-slate-400'
                }`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                ) : isFail ? (
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                ) : (
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                )}
              </div>

              {/* Step Content */}
              <div className="bg-slate-50/70 hover:bg-slate-50 rounded-xl p-4 border border-slate-200/80 transition-all space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">{step.title}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${step.badgeClass}`}>
                      {step.badge}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-400">{step.timestamp}</span>
                </div>

                <div className="text-xs font-semibold text-slate-800">{step.subtitle}</div>
                <p className="text-xs text-slate-600 leading-relaxed">{step.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
