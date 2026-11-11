import React, { useState } from 'react';
import {
  Sparkles,
  MessageSquare,
  Receipt,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  HelpCircle,
  ShieldAlert,
} from 'lucide-react';
import { Group, AIExtractionItem } from '../types';
import { runAIExtraction } from '../api/client';

interface AIImportPageProps {
  group: Group | null;
  onNavigateToReview: () => void;
  onExtractionCompleted: () => void;
}

export const AIImportPage: React.FC<AIImportPageProps> = ({
  group,
  onNavigateToReview,
  onExtractionCompleted,
}) => {
  const [sourceType, setSourceType] = useState<'CONVERSATION' | 'RECEIPT'>('CONVERSATION');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<{
    engine: string;
    isLiveAI: boolean;
    overallSummary: string;
    items: AIExtractionItem[];
  } | null>(null);

  const sampleConversation = `Alex: I paid €450 for the hotel.
Sam: I'll send you €150.
John: I already transferred €100 yesterday.
Alex: Dinner was another €75.
Sam: Wait, John was supposed to cover dinner.`;

  const sampleReceipt = `BISTRO DE TOKYO
Date: 2026-11-03
Item 1: Wagyu Steak €42.50
Item 2: Red Wine €42.00
TOTAL: €84.50
CARD: VISA 4921`;

  const handleRunExtraction = async () => {
    if (!group || !inputText.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await runAIExtraction(group.id, inputText, sourceType);
      setResults(res);
      onExtractionCompleted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getClassificationBadge = (classification: string) => {
    switch (classification) {
      case 'CONFIRMED_EXPENSE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            CONFIRMED EXPENSE
          </span>
        );
      case 'REPAYMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
            <CheckCircle2 className="w-3 h-3 text-sky-600" />
            REPAYMENT
          </span>
        );
      case 'PAYMENT_PROMISE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-purple-50 text-purple-800 border border-purple-200">
            <Clock className="w-3 h-3 text-purple-600" />
            PAYMENT PROMISE
          </span>
        );
      case 'PROPOSED_EXPENSE':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <HelpCircle className="w-3 h-3 text-slate-500" />
            PROPOSED EXPENSE
          </span>
        );
      case 'UNRESOLVED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-rose-50 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            UNRESOLVED DISPUTE
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">AI Expense Intelligence</h1>
          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-xs font-semibold">
            Responsible AI Showcase
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1 max-w-3xl">
          Classifies unstructured group conversations and merchant receipts into confirmed expenses, repayments, promises, and disputes.
          AI suggestions are strictly held in the review queue and never enter the financial ledger without human sign-off.
        </p>
      </div>

      {/* Input Box & Format Switcher */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setSourceType('CONVERSATION');
                setInputText('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sourceType === 'CONVERSATION'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Group Chat Log</span>
            </button>
            <button
              onClick={() => {
                setSourceType('RECEIPT');
                setInputText('');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                sourceType === 'RECEIPT'
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Merchant Receipt OCR</span>
            </button>
          </div>

          <button
            onClick={() => setInputText(sourceType === 'CONVERSATION' ? sampleConversation : sampleReceipt)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline decoration-indigo-200"
          >
            Insert {sourceType === 'CONVERSATION' ? 'Hackathon Sample Chat' : 'Sample Receipt'}
          </button>
        </div>

        <div>
          <textarea
            rows={5}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              sourceType === 'CONVERSATION'
                ? "Paste dialogue here...\ne.g.\nAlex: I paid €450 for the hotel.\nSam: I'll send you €150.\nJohn: I already transferred €100 yesterday."
                : "Paste merchant receipt text...\ne.g.\nBistro de Tokyo\nItem 1: €42.50\nTOTAL: €84.50"
            }
            className="w-full p-3 border border-slate-200 rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-slate-900"
          />
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="text-[11px] text-slate-500">
            Engine: Gemini LLM Structured Parser with Deterministic Fallback Mode
          </div>
          <button
            onClick={handleRunExtraction}
            disabled={loading || !inputText.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{loading ? 'Analyzing with AI...' : 'Extract Financial Obligations'}</span>
          </button>
        </div>
      </div>

      {/* Extraction Results */}
      {results && (
        <div className="space-y-4">
          <div className="bg-slate-900 text-white rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-semibold text-emerald-400">Analysis Completed:</span>{' '}
              <span className="text-slate-300">{results.overallSummary}</span>
            </div>
            <button
              onClick={onNavigateToReview}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-slate-950 font-bold hover:bg-slate-100 transition-colors shrink-0"
            >
              <span>Go to Review Queue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {results.items.map((item, idx) => {
              const confidence = Math.round((item.confidenceScore ?? item.confidence_score ?? 0.8) * 100);

              return (
                <div
                  key={item.id || idx}
                  className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      {getClassificationBadge(item.classification)}
                      <span className="text-xs font-bold text-slate-900">{item.description}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span>Confidence:</span>
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              confidence >= 90
                                ? 'bg-emerald-500'
                                : confidence >= 70
                                ? 'bg-amber-500'
                                : 'bg-rose-500'
                            }`}
                            style={{ width: `${confidence}%` }}
                          />
                        </div>
                        <span className="font-mono text-[11px] font-semibold">{confidence}%</span>
                      </div>

                      {item.amount && (
                        <div className="px-2.5 py-1 rounded bg-slate-100 font-bold text-slate-900 text-xs mono-numeric">
                          {item.amount} {item.currency || 'EUR'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Extraction Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 font-medium">Source Message:</span>
                      <div className="p-2.5 rounded-lg bg-slate-50 font-mono text-slate-700 text-[11px] border border-slate-100">
                        {item.sourceText || item.source_text}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-slate-400 font-medium">AI Reasoning:</span>
                      <p className="text-slate-600 text-xs leading-relaxed">{item.explanation}</p>
                    </div>
                  </div>

                  {/* Missing Info Warning */}
                  {(item.missingInformation || item.missing_information || []).length > 0 && (
                    <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/70 text-amber-900 text-[11px] flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <div>
                        <strong>Information gaps flagged:</strong>{' '}
                        {(item.missingInformation || item.missing_information || []).join('; ')}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
