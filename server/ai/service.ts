import { AIExtractionItem, GroupMember } from '../types';
import { extractExpensesFromConversationFallback, extractReceiptDataFallback } from './classifier';
import { v4 as uuidv4 } from 'uuid';

export interface ParseOptions {
  sourceType: 'CONVERSATION' | 'RECEIPT';
  input: string;
  members: GroupMember[];
}

export interface ParseResult {
  engine: 'GEMINI_AI' | 'FALLBACK_DEMO_PARSER';
  isLiveAI: boolean;
  overallSummary: string;
  items: AIExtractionItem[];
}

/**
 * AI Expense Intelligence Service with dual execution modes:
 * 1. Live Gemini LLM structured parsing when GEMINI_API_KEY is configured.
 * 2. High-fidelity Fallback Demonstration Engine when running in demo/offline mode.
 */
export async function parseFinancialInput(options: ParseOptions): Promise<ParseResult> {
  const { sourceType, input, members } = options;
  const apiKey = process.env.GEMINI_API_KEY;

  if (apiKey && apiKey.trim() !== '') {
    try {
      const liveResult = await callGeminiStructuredExtraction(input, sourceType, members, apiKey);
      return {
        engine: 'GEMINI_AI',
        isLiveAI: true,
        overallSummary: liveResult.overallSummary,
        items: liveResult.items.map((item) => ({
          id: uuidv4(),
          classification: item.classification,
          confidenceScore: item.confidenceScore,
          payerName: item.payerName,
          payerId: members.find((m) => m.name.toLowerCase() === item.payerName?.toLowerCase())?.id,
          involvedMembers: item.involvedMembers || members.map((m) => m.name),
          amount: item.amount,
          currency: item.currency || 'EUR',
          description: item.description || 'Extracted Expense',
          date: item.date || new Date().toISOString().split('T')[0],
          sourceText: item.sourceText || input.slice(0, 80),
          splitType: 'EQUAL',
          missingInformation: item.missingInformation || [],
          explanation: item.explanation,
          status: 'PENDING_REVIEW',
        })),
      };
    } catch (err) {
      console.warn('Gemini API call failed or timed out. Falling back to local demonstration parser:', err);
      // Fallback seamlessly
    }
  }

  // Demonstration Fallback Mode
  const fallbackOutput =
    sourceType === 'RECEIPT'
      ? extractReceiptDataFallback(input)
      : extractExpensesFromConversationFallback(input, members);

  return {
    engine: 'FALLBACK_DEMO_PARSER',
    isLiveAI: false,
    overallSummary: `[DEMO PARSER] ${fallbackOutput.overallSummary}`,
    items: fallbackOutput.items.map((item) => ({
      id: uuidv4(),
      classification: item.classification,
      confidenceScore: item.confidenceScore,
      payerName: item.payerName,
      payerId: members.find((m) => m.name.toLowerCase() === item.payerName?.toLowerCase())?.id,
      involvedMembers: item.involvedMembers || members.map((m) => m.name),
      amount: item.amount,
      currency: item.currency || 'EUR',
      description: item.description,
      date: item.date || new Date().toISOString().split('T')[0],
      sourceText: item.sourceText,
      splitType: 'EQUAL',
      missingInformation: item.missingInformation,
      explanation: item.explanation,
      status: 'PENDING_REVIEW',
    })),
  };
}

async function callGeminiStructuredExtraction(
  input: string,
  sourceType: string,
  members: GroupMember[],
  apiKey: string
): Promise<{ overallSummary: string; items: any[] }> {
  const memberListStr = members.map((m) => `${m.name} (${m.preferredCurrency}, ${m.country})`).join(', ');

  const systemPrompt = `You are ClearSettle AI Expense Intelligence.
Your job is to analyze group chat logs or receipt text and extract structured financial actions.

CRITICAL FINANCIAL SAFETY RULES:
1. Classify every detected financial statement into EXACTLY ONE of these 5 categories:
   - CONFIRMED_EXPENSE: A completed purchase by someone for the group.
   - REPAYMENT: A direct peer-to-peer debt reimbursement that already occurred.
   - PAYMENT_PROMISE: A future intention to pay (e.g. "I'll send you €150", "I will pay tomorrow"). DO NOT book as settled cash.
   - PROPOSED_EXPENSE: A future or hypothetical expense suggestion.
   - UNRESOLVED: Any disputed, ambiguous, or contested expense statement (e.g. "Wait, John was supposed to cover dinner").
2. NEVER silently guess missing amounts or currencies. If ambiguous, flag missingInformation and classify as UNRESOLVED.
3. Known group members: ${memberListStr}.
4. Return ONLY valid JSON matching this schema:
{
  "overallSummary": "Concise summary of findings",
  "items": [
    {
      "classification": "CONFIRMED_EXPENSE" | "REPAYMENT" | "PAYMENT_PROMISE" | "PROPOSED_EXPENSE" | "UNRESOLVED",
      "confidenceScore": number (0.0 to 1.0),
      "payerName": string or null,
      "involvedMembers": [string],
      "amount": string or null,
      "currency": "EUR" | "USD" | "GBP" | "INR" | "JPY" | null,
      "description": string,
      "date": string or null,
      "sourceText": string,
      "missingInformation": [string],
      "explanation": string
    }
  ]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: systemPrompt },
              { text: `Analyze this ${sourceType} content:\n\n${input}` },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Gemini API HTTP ${response.status}: ${await response.text()}`);
  }

  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Empty response from Gemini API');
  }

  return JSON.parse(text);
}
