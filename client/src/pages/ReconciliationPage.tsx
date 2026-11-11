import React, { useState, useEffect } from 'react';
import {
  GitCompare,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Info,
  Clock,
  ArrowRight,
  ExternalLink,
  Code,
  DollarSign,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  AlertOctagon,
} from 'lucide-react';
import { Group, ReconciliationRecord, SettlementTransfer } from '../types';
import { PayPalSandboxNotice, UnobservableFeesNote } from '../components/Disclaimers';
import { createPayPalOrder, capturePayPalOrder, fetchEvidenceSummary } from '../api/client';

interface ReconciliationPageProps {
  group: Group | null;
  reconciliations: ReconciliationRecord[];
  activeTransfer: SettlementTransfer | null;
  onClosePaymentModal: () => void;
  onPaymentSuccess: () => void;
}

export const ProvenanceBadge: React.FC<{
  type: 'LEDGER' | 'ESTIMATE' | 'QUOTE' | 'PAYPAL-CAPTURE' | 'SIMULATED';
}> = ({ type }) => {
  switch (type) {
    case 'LEDGER':
      return (
        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-slate-100 text-slate-800 border border-slate-300">
          LEDGER
        </span>
      );
    case 'ESTIMATE':
      return (
        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
          ESTIMATE
        </span>
      );
    case 'QUOTE':
      return (
        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
          QUOTE
        </span>
      );
    case 'PAYPAL-CAPTURE':
      return (
        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
          PAYPAL-CAPTURE
        </span>
      );
    case 'SIMULATED':
    default:
      return (
        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-50 text-amber-800 border border-amber-300">
          SIMULATED
        </span>
      );
  }
};

export const ReconciliationPage: React.FC<ReconciliationPageProps> = ({
  group,
  reconciliations,
  activeTransfer,
  onClosePaymentModal,
  onPaymentSuccess,
}) => {
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'IDLE' | 'CREATING_ORDER' | 'APPROVING' | 'CAPTURING' | 'DONE'>('IDLE');
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [evidenceData, setEvidenceData] = useState<{ exists: boolean; records: any[] }>({ exists: false, records: [] });

  const baseCurrency = group?.baseCurrency || 'EUR';

  useEffect(() => {
    fetchEvidenceSummary().then(setEvidenceData).catch(console.error);
  }, []);

  // Check if simulated data exists
  const hasSimulatedData =
    reconciliations.some((r) => r.capture_provenance === 'SIMULATED' || r.provider === 'DEMO_PROVIDER');

  // Handle PayPal Sandbox Execution Flow
  const handleExecutePayPalCheckout = async () => {
    if (!activeTransfer || !group) return;
    setProcessingPayment(true);
    setPaymentError(null);
    setPaymentStep('CREATING_ORDER');

    try {
      const order = await createPayPalOrder({
        transferId: activeTransfer.id,
        amount: activeTransfer.amount,
        currency: activeTransfer.currency,
        description: `ClearSettle Settlement: ${activeTransfer.fromMemberName} to ${activeTransfer.toMemberName}`,
      });

      setPaymentStep('APPROVING');
      await new Promise((resolve) => setTimeout(resolve, 800));

      setPaymentStep('CAPTURING');
      await capturePayPalOrder({
        providerOrderId: order.providerOrderId,
        transferId: activeTransfer.id,
        groupId: group.id,
      });

      setPaymentStep('DONE');
      await new Promise((resolve) => setTimeout(resolve, 600));
      onPaymentSuccess();
      onClosePaymentModal();
      fetchEvidenceSummary().then(setEvidenceData).catch(console.error);
    } catch (err: any) {
      setPaymentError(err.message);
      setPaymentStep('IDLE');
    } finally {
      setProcessingPayment(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'RECONCILIATION_COMPLETE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            RECONCILIATION COMPLETE
          </span>
        );
      case 'CAPTURE_FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            CAPTURE FAILED
          </span>
        );
      case 'QUOTE_AVAILABLE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
            <Clock className="w-3.5 h-3.5 text-sky-600" />
            QUOTE AVAILABLE
          </span>
        );
      case 'CAPTURE_PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            CAPTURE PENDING
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 py-2">
      {/* SIMULATED DATA BANNER: Hard Rule compliance */}
      {hasSimulatedData && (
        <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-4 text-xs text-amber-950 flex items-start gap-3 shadow-xs">
          <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-bold text-amber-950 uppercase tracking-wide">
              SIMULATED DEMONSTRATION DATA PRESENT
            </div>
            <p className="text-amber-900 leading-relaxed">
              Transactions marked with the <ProvenanceBadge type="SIMULATED" /> badge are generated by DemoProviderAdapter for offline judging.
              Simulated data is strictly excluded from verified <code className="font-mono bg-amber-100 px-1 rounded">/evidence/</code> capture files.
              Real sandbox mode is active by default when <code className="font-mono bg-amber-100 px-1 rounded">PAYPAL_CLIENT_ID</code> is configured in <code className="font-mono bg-amber-100 px-1 rounded">.env</code>.
            </p>
          </div>
        </div>
      )}

      <PayPalSandboxNotice />

      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Payment Reconciliation Engine</h1>
          <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-xs font-semibold">
            ClearSettle Differentiator
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 max-w-3xl">
          Traceable 4-way audit contrasting Group Ledger Value, Provider Quotation, Actual Provider Capture, and
          Discrepancy Analysis with transparent fee visibility.
        </p>
      </div>

      {/* SECTION P0-3: MEASURED TABLE FROM summary.csv */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden space-y-3 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-900">
              Measured Sandbox Capture Evidence Table (<code className="font-mono text-xs">summary.csv</code>)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">
            {evidenceData.exists ? `${evidenceData.records.length} real capture(s) recorded` : 'Run `npm run evidence` to generate'}
          </span>
        </div>

        {evidenceData.records.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                <tr>
                  <th className="py-2.5 px-3">Currency Pair</th>
                  <th className="py-2.5 px-3">Gross Captured</th>
                  <th className="py-2.5 px-3">PayPal Fee</th>
                  <th className="py-2.5 px-3">Net Received</th>
                  <th className="py-2.5 px-3">PayPal Rate</th>
                  <th className="py-2.5 px-3">ECB Benchmark</th>
                  <th className="py-2.5 px-3">Measured Spread</th>
                  <th className="py-2.5 px-3">Provenance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {evidenceData.records.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 font-mono text-[11px]">
                    <td className="py-2 px-3 font-bold text-slate-900">{r.pair}</td>
                    <td className="py-2 px-3">{r.grossAmount} {r.orderCurrency}</td>
                    <td className="py-2 px-3 text-rose-600">-{r.paypalFee}</td>
                    <td className="py-2 px-3 text-emerald-700 font-bold">{r.netAmount}</td>
                    <td className="py-2 px-3">{r.paypalExchangeRate}</td>
                    <td className="py-2 px-3">{r.ecbReferenceRate}</td>
                    <td className="py-2 px-3 font-bold text-amber-700">{r.effectiveSpreadVsECB}</td>
                    <td className="py-2 px-3"><ProvenanceBadge type="PAYPAL-CAPTURE" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-600 space-y-1">
            <p>
              <strong>No live captures in summary.csv yet.</strong> To capture real sandbox transactions and populate this table:
            </p>
            <p className="font-mono text-[11px] bg-slate-100 p-2 rounded text-slate-800">
              1. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to .env<br />
              2. Run: npm run evidence
            </p>
          </div>
        )}

        <div className="p-3 rounded-lg bg-slate-50 border border-slate-100 text-[11px] text-slate-600 flex items-start gap-2">
          <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
          <span>
            <strong>Architectural Disclosure:</strong> Payer-side funding source conversions and credit card issuer foreign transaction surcharges (typically 1–3%) occur outside the PayPal API and are unobservable to ClearSettle.
          </span>
        </div>
      </div>

      <UnobservableFeesNote />

      {/* List of Reconciled Transactions */}
      {reconciliations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center text-xs text-slate-500 shadow-xs">
          No reconciled payment transactions recorded yet. Initiate a payment from the Settlement Optimizer to trigger the engine.
        </div>
      ) : (
        <div className="space-y-6">
          {reconciliations.map((rec) => {
            const isExpanded = selectedRecordId === rec.id;
            const captureProvenance = rec.capture_provenance || (rec.provider === 'PAYPAL_SANDBOX' ? 'PAYPAL-CAPTURE' : 'SIMULATED');

            return (
              <div
                key={rec.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden"
              >
                {/* Transaction Header Banner */}
                <div className="bg-slate-900 text-white p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-bold text-base tracking-tight">
                        {rec.from_member_name || 'Sender'} → {rec.to_member_name || 'Receiver'}
                      </span>
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-white/10 text-slate-200">
                        {rec.transaction_id}
                      </span>
                      <ProvenanceBadge type={captureProvenance} />
                    </div>
                    <div className="text-xs text-slate-400 font-mono">
                      Recorded: {rec.created_at?.replace('T', ' ').split('.')[0]} • Provider: {rec.provider}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {getStatusBadge(rec.status)}
                    <button
                      onClick={() => setSelectedRecordId(isExpanded ? null : rec.id)}
                      className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-medium transition-colors flex items-center gap-1"
                    >
                      <span>{isExpanded ? 'Hide Raw Details' : 'View Audit Breakdown'}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* THE 4-WAY COMPARISON GRID (The Visual Centerpiece with Provenance Badges) */}
                <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50/50">
                  {/* Column 1: Group Ledger Value */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2">
                      <span>1. Group Ledger</span>
                      <ProvenanceBadge type="LEDGER" />
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium">Debt Amount</div>
                        <div className="text-lg font-bold text-slate-900 mono-numeric">
                          {rec.ledger_original_amount} {rec.ledger_original_currency}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 font-medium">Reference Rate</div>
                        <div className="text-xs font-mono font-semibold text-slate-800">
                          {rec.ledger_reference_rate}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">{rec.ledger_rate_source}</div>
                      </div>

                      <div className="pt-1 border-t border-slate-100">
                        <div className="text-[10px] text-slate-400 font-medium">Base Conversion</div>
                        <div className="text-xs font-bold text-slate-900 mono-numeric">
                          {rec.ledger_converted_base_amount} {rec.ledger_base_currency}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Provider Quotation */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2">
                      <span>2. Provider Quote</span>
                      <ProvenanceBadge type="QUOTE" />
                    </div>

                    {rec.quote_status === 'UNAVAILABLE' || !rec.quote_amount ? (
                      <div className="space-y-2 text-xs text-slate-500">
                        <div className="p-2.5 rounded-lg bg-amber-50/70 border border-amber-200/70 text-amber-900 text-[11px] leading-relaxed">
                          <strong>Provider quote unavailable:</strong> PayPal Orders v2 merchant Checkout determines
                          exchange rate and cardholder fees at buyer authorization time.
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">Status: UNAVAILABLE</div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Quoted Amount</div>
                          <div className="text-lg font-bold text-slate-900 mono-numeric">
                            {rec.quote_amount} {rec.quote_currency}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Quoted FX Rate</div>
                          <div className="text-xs font-mono text-slate-800">{rec.quote_fx_rate || 'N/A'}</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Column 3: Actual Provider Result */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2">
                      <span>3. Provider Result</span>
                      <ProvenanceBadge type={captureProvenance} />
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium">Gross Captured</div>
                        <div className="text-lg font-bold text-slate-900 mono-numeric">
                          {rec.capture_gross_amount || '0.00'} {rec.capture_gross_currency}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">PayPal Fee</div>
                          <div className="text-xs font-bold text-rose-600 mono-numeric">
                            -{rec.capture_fee_amount || '0.00'} {rec.capture_fee_currency}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Net Credited</div>
                          <div className="text-xs font-bold text-emerald-700 mono-numeric">
                            {rec.capture_net_amount || '0.00'} {rec.capture_net_currency}
                          </div>
                        </div>
                      </div>

                      <div className="pt-1 border-t border-slate-100 text-[10px] font-mono text-slate-500 truncate">
                        ID: {rec.capture_id}
                      </div>
                    </div>
                  </div>

                  {/* Column 4: Reconciliation Math & Discrepancy Analysis */}
                  <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-xs">
                    <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between border-b border-slate-100 pb-2">
                      <span>4. Discrepancy & Net</span>
                      <ProvenanceBadge type={rec.observed_provider_fee ? captureProvenance : 'ESTIMATE'} />
                    </div>

                    <div className="space-y-2">
                      <div>
                        <div className="text-[10px] text-slate-400 font-medium">Ledger vs Gross Variance</div>
                        <div className="text-sm font-bold mono-numeric text-slate-900">
                          {rec.diff_ledger_vs_capture_gross !== null
                            ? `${rec.diff_ledger_vs_capture_gross} ${rec.ledger_original_currency}`
                            : 'N/A'}
                        </div>
                      </div>

                      <div>
                        <div className="text-[10px] text-slate-400 font-medium">Fee Friction Cost</div>
                        <div className="text-xs font-bold text-amber-700 mono-numeric">
                          {rec.observed_provider_fee} {rec.capture_fee_currency}
                        </div>
                      </div>

                      <div className="pt-1 border-t border-slate-100">
                        <div className="text-[10px] text-slate-400 font-medium">Payee Proceeds Shortfall</div>
                        <div className="text-xs font-semibold text-slate-700">
                          Payee received net proceeds of {rec.capture_net_amount} {rec.capture_net_currency}.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Explanatory Narrative Footer */}
                <div className="p-4 bg-white border-t border-slate-100 text-xs text-slate-600 space-y-1">
                  <div className="font-semibold text-slate-800">ClearSettle Financial Provenance Analysis:</div>
                  <p className="leading-relaxed">{rec.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Interactive PayPal Sandbox Checkout Modal */}
      {activeTransfer && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">PayPal Sandbox Checkout</h3>
                <p className="text-[11px] text-slate-500">Merchant Orders v2 Checkout Sandbox Flow</p>
              </div>
              <button
                onClick={onClosePaymentModal}
                disabled={processingPayment}
                className="text-slate-400 hover:text-slate-600 text-sm"
              >
                ✕
              </button>
            </div>

            {paymentError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {paymentError}
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Payer (Sender):</span>
                <span className="font-bold text-slate-900">{activeTransfer.fromMemberName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Recipient (Seller):</span>
                <span className="font-bold text-slate-900">{activeTransfer.toMemberName}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                <span className="text-slate-500">Amount to Capture:</span>
                <span className="font-bold text-base text-slate-900 mono-numeric">
                  {activeTransfer.amount} {activeTransfer.currency}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>Est. Merchant Processing Fee:</span>
                <span className="font-mono text-slate-700">~{activeTransfer.estimatedFee} EUR</span>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200/80 rounded-lg p-3 text-[11px] text-amber-900 leading-relaxed">
              <strong>Sandbox Demonstration Notice:</strong> This executes server-side order creation and capture via PayPal Orders v2 REST API.
              Server verifies capture status, records fee breakdown, and generates a reconciliation audit record.
            </div>

            <div className="space-y-2">
              <button
                onClick={handleExecutePayPalCheckout}
                disabled={processingPayment}
                className="w-full py-3 rounded-xl bg-[#0070ba] hover:bg-[#003087] text-white font-bold text-sm transition-colors shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {processingPayment ? (
                  <span>
                    {paymentStep === 'CREATING_ORDER' && 'Creating PayPal Sandbox Order...'}
                    {paymentStep === 'APPROVING' && 'Simulating Sandbox Buyer Approval...'}
                    {paymentStep === 'CAPTURING' && 'Server Capturing & Reconciling...'}
                    {paymentStep === 'DONE' && 'Capture Verified!'}
                  </span>
                ) : (
                  <>
                    <span>Complete PayPal Sandbox Checkout</span>
                  </>
                )}
              </button>

              <button
                onClick={onClosePaymentModal}
                disabled={processingPayment}
                className="w-full py-2 rounded-lg text-slate-500 hover:text-slate-700 text-xs font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
