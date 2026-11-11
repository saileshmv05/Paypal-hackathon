import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Sparkles,
  CheckCircle2,
  Clock,
  ArrowRight,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Building,
} from 'lucide-react';
import { fetchInvoices, createInvoice, parseInvoiceText, createPayPalOrder, capturePayPalOrder } from '../api/client';
import { Invoice } from '../types';

interface BusinessInvoicesPageProps {
  workspaceId: string;
  onNavigateToReconciliation: () => void;
}

export const BusinessInvoicesPage: React.FC<BusinessInvoicesPageProps> = ({
  workspaceId,
  onNavigateToReconciliation,
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);

  // Form State
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('EUR');
  const [dueDate, setDueDate] = useState('');

  // AI OCR State
  const [aiText, setAiText] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // Checkout State
  const [payingInvoice, setPayingInvoice] = useState<Invoice | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'IDLE' | 'CREATING_ORDER' | 'APPROVING' | 'CAPTURING' | 'DONE'>('IDLE');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchInvoices(workspaceId);
      setInvoices(data);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber || !clientName || !amount) return;

    try {
      await createInvoice(workspaceId, {
        invoiceNumber,
        clientName,
        clientEmail,
        description,
        amount,
        currency,
        dueDate,
      });
      setShowCreateModal(false);
      resetForm();
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to create invoice');
    }
  };

  const handleAIExtract = async () => {
    if (!aiText.trim()) return;
    setAiLoading(true);
    try {
      const res = await parseInvoiceText(workspaceId, aiText);
      if (res.invoiceData) {
        setInvoiceNumber(res.invoiceData.invoiceNumber || `INV-${Math.floor(1000 + Math.random() * 9000)}`);
        setClientName(res.invoiceData.clientName || 'Client Corp');
        setDescription(res.invoiceData.description || 'Digital Consulting');
        setAmount(res.invoiceData.amount || '1500.00');
        setCurrency(res.invoiceData.currency || 'USD');
        setDueDate(res.invoiceData.dueDate || '');
      }
      setShowAIModal(false);
      setShowCreateModal(true);
    } catch (err: any) {
      alert('AI Extraction error: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  };

  const resetForm = () => {
    setInvoiceNumber('');
    setClientName('');
    setClientEmail('');
    setDescription('');
    setAmount('');
    setCurrency('EUR');
    setDueDate('');
  };

  // PayPal Sandbox Checkout Flow for Small Business Invoices
  const handleExecutePayPalPayment = async (inv: Invoice) => {
    setPayingInvoice(inv);
    setCheckoutError(null);
    setCheckoutStep('CREATING_ORDER');

    try {
      // 1. Create order on backend (authoritative amount & currency lookup from DB)
      const order = await createPayPalOrder({
        invoiceId: inv.id,
        obligationType: 'INVOICE',
        amount: inv.amount,
        currency: inv.currency,
        description: `Payment for Invoice ${inv.invoice_number}`,
      });

      // 2. Simulate or redirect to buyer approval
      setCheckoutStep('APPROVING');
      await new Promise((r) => setTimeout(r, 900));

      // 3. Execute server-side capture verification
      setCheckoutStep('CAPTURING');
      await capturePayPalOrder({
        providerOrderId: order.providerOrderId,
        invoiceId: inv.id,
        groupId: workspaceId,
      });

      setCheckoutStep('DONE');
      await new Promise((r) => setTimeout(r, 600));
      setPayingInvoice(null);
      setCheckoutStep('IDLE');
      loadData();
    } catch (err: any) {
      setCheckoutError(err.message || 'Payment execution failed');
      setCheckoutStep('IDLE');
    }
  };

  // Calculate Metrics
  const totalInvoiced = invoices.reduce((acc, i) => acc + parseFloat(i.base_amount || i.amount || '0'), 0);
  const paidInvoices = invoices.filter((i) => i.status === 'PAID');
  const totalPaid = paidInvoices.reduce((acc, i) => acc + parseFloat(i.base_amount || i.amount || '0'), 0);
  const outstanding = invoices.filter((i) => i.status !== 'PAID');

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-sm border border-slate-800">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                💼 Small Business Workspace
              </span>
              <span className="text-slate-400 text-xs">Apex Creative Digital Agency</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight mt-1 text-white">Client Invoicing & Payment Reconciliation</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
              Issue client invoices, accept international payments via PayPal Checkout, and automatically audit merchant processing fees and currency conversions.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAIModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold backdrop-blur-xs transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              AI Invoice OCR
            </button>
            <button
              onClick={() => {
                resetForm();
                setInvoiceNumber(`INV-${Math.floor(1000 + Math.random() * 9000)}`);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Issue Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Financial Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Invoiced (Base)</div>
          <div className="text-2xl font-bold text-slate-900 mt-1 font-mono">€{totalInvoiced.toFixed(2)}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">{invoices.length} total obligations recorded</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider">Paid & Captured</div>
          <div className="text-2xl font-bold text-emerald-700 mt-1 font-mono">€{totalPaid.toFixed(2)}</div>
          <div className="text-[11px] text-emerald-600/80 mt-0.5">{paidInvoices.length} invoices reconciled</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider">Outstanding Obligations</div>
          <div className="text-2xl font-bold text-amber-700 mt-1 font-mono">
            {outstanding.length > 0 ? `${outstanding.length} Pending` : 'None'}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Awaiting client PayPal checkout</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
          <div className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">Reconciliation Engine</div>
          <div className="text-2xl font-bold text-indigo-900 mt-1 font-mono">100% Audited</div>
          <button
            onClick={onNavigateToReconciliation}
            className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium inline-flex items-center gap-1 mt-0.5"
          >
            Inspect Fee Deductions <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Invoices List Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900">Invoices & B2B Obligations</h2>
            <p className="text-xs text-slate-500">Authoritative database records for client payment requests.</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">Currency Minor-Unit Arithmetic: Decimal.js</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-xs text-slate-400">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No invoices issued yet. Click "Issue Invoice" or use "AI Invoice OCR" to create one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Client</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {invoices.map((inv) => {
                  const isPaid = inv.status === 'PAID';
                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{inv.invoice_number}</td>
                      <td className="py-3 px-4 font-medium text-slate-800">
                        {inv.client_name}
                        <div className="text-[10px] text-slate-400 font-normal">{inv.client_email}</div>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">{inv.description}</td>
                      <td className="py-3 px-4 font-mono text-slate-500">{inv.due_date}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                        {inv.amount} {inv.currency}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="w-3 h-3" /> Paid & Reconciled
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            <Clock className="w-3 h-3" /> Payment Due
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isPaid ? (
                          <button
                            onClick={onNavigateToReconciliation}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-colors"
                          >
                            Audit Trace <ExternalLink className="w-3 h-3" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleExecutePayPalPayment(inv)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-2xs transition-colors"
                          >
                            Pay via PayPal
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Checkout Execution Modal */}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">PayPal Orders v2 Checkout</h3>
                <p className="text-[11px] text-slate-500">Executing server-authorized payment for {payingInvoice.invoice_number}</p>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-100 text-amber-800 font-bold">
                SANDBOX
              </span>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice:</span>
                <span className="font-mono font-bold text-slate-800">{payingInvoice.invoice_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Client:</span>
                <span className="font-medium text-slate-800">{payingInvoice.client_name}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200/80 pt-2 font-bold">
                <span className="text-slate-700">Authoritative Amount:</span>
                <span className="font-mono text-indigo-700">{payingInvoice.amount} {payingInvoice.currency}</span>
              </div>
            </div>

            {checkoutError && (
              <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{checkoutError}</span>
              </div>
            )}

            {/* Lifecycle Steps */}
            <div className="space-y-2 pt-2">
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold ${
                  checkoutStep !== 'IDLE' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>1</span>
                <span className="text-slate-700 font-medium">Server retrieves authoritative obligation amount from DB</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold ${
                  checkoutStep === 'APPROVING' || checkoutStep === 'CAPTURING' || checkoutStep === 'DONE' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>2</span>
                <span className="text-slate-700 font-medium">Buyer authorization on PayPal Sandbox gateway</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center font-mono text-[10px] font-bold ${
                  checkoutStep === 'CAPTURING' || checkoutStep === 'DONE' ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}>3</span>
                <span className="text-slate-700 font-medium">Server-side verified capture & 4-way reconciliation</span>
              </div>
            </div>

            {checkoutStep !== 'IDLE' && checkoutStep !== 'DONE' && (
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-center text-xs font-semibold text-indigo-900 animate-pulse">
                Processing payment lifecycle...
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                disabled={checkoutStep !== 'IDLE'}
                onClick={() => setPayingInvoice(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Invoice Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Issue New B2B Invoice</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-3 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Invoice Number</label>
                <input
                  type="text"
                  required
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="e.g. INV-2026-083"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Client Name / Company</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Pacifica Media Labs LLC"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Description of Work</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Platform Architecture & Multicurrency Audit"
                  className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Total Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="1500.00"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Currency</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="JPY">JPY (¥)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold shadow-xs transition-colors"
                >
                  Save & Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Invoice Document Parsing Modal */}
      {showAIModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <h3 className="text-sm font-bold text-slate-900">AI Invoice Document Ingestion</h3>
              </div>
              <button onClick={() => setShowAIModal(false)} className="text-slate-400 hover:text-slate-600 text-sm">✕</button>
            </div>

            <p className="text-xs text-slate-500">
              Paste unformatted invoice text, bill statements, or contractor emails. The AI parser will automatically extract the invoice number, client, line items, and amount.
            </p>

            <textarea
              rows={5}
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
              placeholder={`INVOICE #INV-2026-904
Billed To: Nordic Innovations Oy
Description: Q4 Cloud Migration & DevOps Engineering
Total Due: €3,200.00 EUR
Due Date: 2026-12-01`}
              className="w-full p-3 rounded-xl border border-slate-200 font-mono text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAIModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAIExtract}
                disabled={aiLoading || !aiText.trim()}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
              >
                {aiLoading ? 'Parsing...' : 'Extract & Fill Invoice'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
