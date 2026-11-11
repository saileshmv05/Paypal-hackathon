import React from 'react';
import { ShieldAlert, Info, AlertTriangle, CheckCircle2 } from 'lucide-react';

export const PayPalSandboxNotice: React.FC = () => {
  return (
    <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 flex items-start gap-3 shadow-xs">
      <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
      <div>
        <span className="font-semibold text-amber-950">PayPal Integration Notice:</span>{' '}
        This demonstration uses PayPal’s official Orders v2 REST API merchant Checkout model in sandbox mode.
        It is explicitly distinct from the group’s internal debt-settlement ledger and does not represent a universal P2P friend-to-friend settlement API.
      </div>
    </div>
  );
};

export const HonestyGuaranteeBanner: React.FC = () => {
  return (
    <div className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm border border-slate-800">
      <div className="flex items-center gap-2.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <div>
          <span className="font-medium text-white">ClearSettle Financial Provenance Guarantee:</span>{' '}
          <span className="text-slate-300">
            Calculations use exact decimal arithmetic (Decimal.js). Every conversion rate records source and timestamp; provider fees are verified server-side.
          </span>
        </div>
      </div>
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[11px] whitespace-nowrap">
        <span>ISO 4217 & ECB Rates</span>
      </div>
    </div>
  );
};

export const UnobservableFeesNote: React.FC = () => {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600 flex items-start gap-2.5">
      <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
      <span>
        <strong>Fee Transparency Note:</strong> ClearSettle displays verified provider transaction fees returned by the processor capture breakdown. External bank or card issuer cross-border surcharges (typically 1-3%) occur outside the PayPal API and cannot be directly observed.
      </span>
    </div>
  );
};
