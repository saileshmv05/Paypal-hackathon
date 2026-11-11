import React from 'react';
import {
  Settings,
  Shield,
  Coins,
  Cpu,
  RotateCcw,
  ExternalLink,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { SystemConfig } from '../types';
import { PayPalSandboxNotice } from '../components/Disclaimers';

interface SettingsPageProps {
  config: SystemConfig | null;
  onResetDemo: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({ config, onResetDemo }) => {
  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System & Provider Configuration</h1>
        <p className="text-xs text-slate-500 mt-1">
          Inspect payment adapters, AI services, central bank exchange rate sources, and ISO 4217 minor unit rules.
        </p>
      </div>

      <PayPalSandboxNotice />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PayPal Integration Status */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900">PayPal Orders v2 Checkout Sandbox</h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                config?.paypal.isConfigured
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border border-amber-200'
              }`}
            >
              {config?.paypal.mode || 'SANDBOX'}
            </span>
          </div>

          <div className="space-y-2 text-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Environment:</span>
              <span className="font-mono font-semibold text-slate-800">api-m.sandbox.paypal.com</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Sandbox Client ID:</span>
              <span className="font-mono text-slate-700 truncate max-w-[200px]">
                {config?.paypal.clientId || 'Not configured (using Demo Adapter)'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Server Capture Idempotency:</span>
              <span className="text-emerald-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Enabled (PayPal-Request-Id)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600 space-y-1">
            <strong>Merchant vs P2P Architecture Note:</strong>
            <p>
              Orders v2 is a merchant checkout API. A sender pays a merchant order; PayPal assesses merchant fees
              (standard 3.49% + $0.49). Funds credit to seller balance. P2P transfers are not universally available via open sandbox APIs.
            </p>
          </div>
        </div>

        {/* AI Engine Status */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-amber-600" />
              <h3 className="font-bold text-slate-900">AI Expense Intelligence Service</h3>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                config?.ai.isLiveConfigured
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-slate-100 text-slate-800 border border-slate-200'
              }`}
            >
              {config?.ai.engine || 'Demo Engine Active'}
            </span>
          </div>

          <div className="space-y-2 text-slate-600">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Primary Provider:</span>
              <span className="font-semibold text-slate-800">Google Gemini API (JSON Schema)</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Fallback Mechanism:</span>
              <span className="text-slate-800">Deterministic Dialogue & Receipt Parser</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Human Approval Rule:</span>
              <span className="text-emerald-700 font-semibold">Strict (Never silently approves)</span>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600 space-y-1">
            <strong>Responsible AI Invariant:</strong>
            <p>
              AI does not calculate sums, balances, or currency conversions. AI is only permitted to classify natural-language intent into 5 discrete states.
            </p>
          </div>
        </div>
      </div>

      {/* ISO 4217 Currency Rules & ECB Reference Rates Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-slate-900">ISO 4217 Precision & ECB Benchmark Exchange Rates</h3>
          </div>
          <span className="text-slate-400 font-mono text-[11px]">European Central Bank Reference Fixing</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {config?.currencies &&
            Object.values(config.currencies).map((curr: any) => (
              <div key={curr.code} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{curr.code}</span>
                  <span className="text-base">{curr.flag}</span>
                </div>
                <div className="text-[11px] text-slate-500">{curr.name}</div>
                <div className="pt-1 text-[11px] font-mono text-slate-700">
                  Decimals: <strong>{curr.decimals}</strong> {curr.decimals === 0 ? '(Zero Minor Units)' : ''}
                </div>
                <div className="text-[10px] font-mono text-slate-400">
                  1 EUR = {config.referenceRates[curr.code]} {curr.code}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Reset Demo Data Action */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div>
          <h4 className="font-bold text-slate-900">Reset Hackathon Demonstration Dataset</h4>
          <p className="text-slate-500 text-[11px]">
            Restores the original Tokyo & Munich summit with Alex (€450 hotel), John (¥25,268 Kaiseki), Sam ($162.75 transit), and review queue items.
          </p>
        </div>
        <button
          onClick={onResetDemo}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-800 font-semibold transition-colors shrink-0"
        >
          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
          <span>Reset Demo Dataset</span>
        </button>
      </div>
    </div>
  );
};
