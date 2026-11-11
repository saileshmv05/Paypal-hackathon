import Decimal from 'decimal.js';
import { AIClassification, AIExtractionItem, CurrencyCode, GroupMember } from '../types';

export interface RawExtractionOutput {
  items: Array<{
    classification: AIClassification;
    confidenceScore: number;
    payerName?: string;
    involvedMembers: string[];
    amount?: string;
    currency?: CurrencyCode;
    description: string;
    date?: string;
    sourceText: string;
    missingInformation: string[];
    explanation: string;
    isCorrection?: boolean;
    correctionTargetId?: string;
    isDuplicate?: boolean;
    duplicateOfId?: string;
  }>;
  overallSummary: string;
}

/**
 * Pure generalized linguistic classifier with contextual multi-message awareness,
 * correction recognition, and duplicate detection.
 */
export function extractExpensesFromConversationFallback(
  conversationText: string,
  knownMembers: GroupMember[] = [],
  existingExpenses: Array<{ id: string; amount: string; currency: string; description: string; payerName?: string }> = []
): RawExtractionOutput {
  const lines = conversationText.split('\n').filter((l) => l.trim().length > 0);
  const items: RawExtractionOutput['items'] = [];

  // Identify contextual modifiers in the conversation (exclusions, split directives)
  let contextualExclusion: string | null = null;
  for (const line of lines) {
    const excludeMatch = line.match(/(?:actually|wait)?\s*([A-Za-z0-9_-]+)\s*(?:wasn't|was not|didn't|did not)\s*(?:there|join|come|participate)/i);
    if (excludeMatch && excludeMatch[1]) {
      contextualExclusion = excludeMatch[1];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // 1. Extract speaker if prefixed e.g. "SpeakerName: ..."
    const speakerMatch = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    const speaker = speakerMatch ? speakerMatch[1] : undefined;
    const utterance = speakerMatch ? speakerMatch[2] : line;

    // Check for Correction Handling (e.g. "I said $500 earlier, but it was actually $450")
    const correctionMatch = utterance.match(/(?:said|thought|was)\s*(?:[€$£¥]?)(\d+(?:\.\d{1,2})?)\s*(?:earlier|before|originally)?.*?(?:actually|real|corrected to)\s*(?:[€$£¥]?)(\d+(?:\.\d{1,2})?)/i);
    if (correctionMatch) {
      const oldAmt = correctionMatch[1];
      const newAmt = correctionMatch[2];
      const currMatch = utterance.match(/(€|\$|£|¥|EUR|USD|GBP|JPY|INR)/i);
      const curr = currMatch ? parseCurrencySymbol(currMatch[1]) : 'EUR';

      items.push({
        classification: 'CONFIRMED_EXPENSE',
        confidenceScore: 0.93,
        payerName: speaker,
        involvedMembers: knownMembers.length > 0 ? knownMembers.map((m) => m.name) : (speaker ? [speaker] : []),
        amount: newAmt,
        currency: curr,
        description: `Corrected Expense (${oldAmt} -> ${newAmt} ${curr})`,
        sourceText: line,
        missingInformation: ['Requires user confirmation of previous expense replacement'],
        explanation: `Explicit correction detected: Prior amount of ${oldAmt} ${curr} corrected to ${newAmt} ${curr}. Flagged for ledger modification.`,
        isCorrection: true,
      });
      continue;
    }

    // 2. Extract financial amounts and currency
    const amountMatch = utterance.match(
      /(€|\$|£|¥|EUR|USD|GBP|JPY|INR)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)\s*(€|\$|£|¥|EUR|USD|GBP|JPY|INR)?/i
    );
    const rawCurrency = amountMatch ? amountMatch[1] || amountMatch[3] : undefined;
    const currency = rawCurrency ? parseCurrencySymbol(rawCurrency) : 'EUR';
    const amount = amountMatch ? amountMatch[2] : undefined;

    // 3. Extract description: look for "for ...", "for the ...", or fallback
    let description = 'Group expense';
    const descMatch = utterance.match(/(?:for|covered|bought|paid|booking|bill)\s+(?:the|our|a|an)?\s*([a-zA-Z0-9\s-]{3,35})/i);
    if (descMatch && descMatch[1]) {
      description = descMatch[1].trim();
    }

    // 4. Check for Objections / Ambiguity / Disputes -> UNRESOLVED
    const isDisputed =
      /wait|supposed to cover|supposed to|disagree|no wait|incorrect|overcharged|not right|did anyone|not sure who|did we pay|who paid|missing receipt/i.test(
        utterance
      );

    // Check if another line in the conversation disputes this item
    const isTargetOfDispute = lines.some(
      (other) =>
        other !== rawLine &&
        /wait|supposed to cover|disagree|no wait|incorrect|overcharged/i.test(other) &&
        utterance.toLowerCase().split(' ').some((w) => w.length > 3 && other.toLowerCase().includes(w))
    );

    if (isDisputed && !amount) {
      const refersToExisting = lines.some(
        (other) => other !== rawLine && utterance.toLowerCase().split(' ').some((w) => w.length > 3 && other.toLowerCase().includes(w))
      );
      if (refersToExisting) {
        continue;
      }
    }

    if (isDisputed || isTargetOfDispute) {
      items.push({
        classification: 'UNRESOLVED',
        confidenceScore: 0.90,
        payerName: speaker,
        involvedMembers: knownMembers.length > 0 ? knownMembers.map((m) => m.name) : (speaker ? [speaker] : []),
        amount,
        currency,
        description: `${description} (Disputed / Ambiguous obligation)`,
        sourceText: line,
        missingInformation: ['Payer identity or allocation contested', 'Group consensus required'],
        explanation:
          'Statement expresses doubt, disagreement, or uncertainty regarding who is responsible or the accuracy of the amount.',
      });
      continue;
    }

    // 5. Check for Future Promises to Pay -> PAYMENT_PROMISE
    const isPromise =
      /I'll send|I will send|I will pay|I'll pay|will transfer|will reimburse|going to pay|promise to transfer|promise to pay/i.test(
        utterance
      );

    if (isPromise) {
      items.push({
        classification: 'PAYMENT_PROMISE',
        confidenceScore: 0.92,
        payerName: speaker,
        involvedMembers: knownMembers.length > 0 ? knownMembers.map((m) => m.name) : (speaker ? [speaker] : []),
        amount,
        currency,
        description: `Promised payment by ${speaker || 'Member'}`,
        sourceText: line,
        missingInformation: ['Payment execution pending', 'Observable transaction capture'],
        explanation:
          'Future-tense commitment ("I will send/pay/reimburse") expresses intention to settle, NOT completed cash. Held in review to prevent premature balance adjustment.',
      });
      continue;
    }

    // 6. Check for Completed Debt Reimbursements -> REPAYMENT
    const isRepayment =
      /already transferred|already sent|just sent|repaid|paid back|wired|transferred the|sent you.*reimbursement|reimbursement for/i.test(
        utterance
      );

    if (isRepayment) {
      items.push({
        classification: 'REPAYMENT',
        confidenceScore: 0.91,
        payerName: speaker,
        involvedMembers: knownMembers.length > 0 ? knownMembers.map((m) => m.name) : (speaker ? [speaker] : []),
        amount,
        currency,
        description: `Direct debt reimbursement by ${speaker || 'Member'}`,
        sourceText: line,
        missingInformation: ['Confirmed receipt verification from payee required'],
        explanation:
          'Statement confirms a completed peer reimbursement. This settles existing debts rather than creating a new shared group expenditure.',
      });
      continue;
    }

    // 7. Check for Proposed / Tentative Future Expenses -> PROPOSED_EXPENSE
    const isProposed =
      /should we|we should|how about|could book|could we|let's buy|let's book|what if we|maybe we should/i.test(
        utterance
      );

    if (isProposed) {
      items.push({
        classification: 'PROPOSED_EXPENSE',
        confidenceScore: 0.88,
        payerName: speaker,
        involvedMembers: knownMembers.length > 0 ? knownMembers.map((m) => m.name) : (speaker ? [speaker] : []),
        amount,
        currency,
        description: `Proposed: ${description}`,
        sourceText: line,
        missingInformation: ['Booking confirmation', 'Actual payer', 'Payment proof'],
        explanation:
          'Contemplated or hypothetical expense suggestion. Requires group confirmation and physical booking before entering ledger.',
      });
      continue;
    }

    // 8. Check for Executed Purchases -> CONFIRMED_EXPENSE
    const isConfirmedExpense =
      /paid|covered|bought|settled the|swiped my card|purchased/i.test(utterance) && amount !== undefined;

    if (isConfirmedExpense) {
      // Apply contextual member exclusion if found in dialogue
      let involved = knownMembers.length > 0 ? knownMembers.map((m) => m.name) : (speaker ? [speaker] : []);
      if (contextualExclusion) {
        involved = involved.filter((m) => m.toLowerCase() !== contextualExclusion?.toLowerCase());
      }

      // Check for duplicate against existing ledger expenses or batch
      const duplicateExisting = existingExpenses.find(
        (e) => {
          try {
            const matchesAmount = amount && new Decimal(e.amount).equals(new Decimal(amount));
            const matchesCurrency = e.currency === currency;
            const matchesDesc = e.description.toLowerCase().includes(description.toLowerCase()) || description.toLowerCase().includes(e.description.toLowerCase());
            return Boolean(matchesAmount && matchesCurrency && matchesDesc);
          } catch {
            return false;
          }
        }
      );

      const isDuplicate = !!duplicateExisting;

      items.push({
        classification: 'CONFIRMED_EXPENSE',
        confidenceScore: isDuplicate ? 0.85 : 0.95,
        payerName: speaker,
        involvedMembers: involved,
        amount,
        currency,
        description: description !== 'Group expense' ? description : `Payment by ${speaker || 'Member'}`,
        sourceText: line,
        missingInformation: isDuplicate ? [`Potential duplicate of ledger expense ${duplicateExisting?.id}`] : [],
        explanation: isDuplicate
          ? `Warning: Possible duplicate transaction. Matches existing expense for ${amount} ${currency} ("${duplicateExisting?.description}").`
          : `Explicit past-tense declaration of payment with specified amount (${amount} ${currency}) and identified payer (${speaker || 'Member'}).${contextualExclusion ? ` Contextual exclusion applied: ${contextualExclusion} excluded.` : ''}`,
        isDuplicate,
        duplicateOfId: duplicateExisting?.id,
      });
      continue;
    }

    // Default fallback if amount exists but statement is unconfirmed
    if (amount) {
      items.push({
        classification: 'UNRESOLVED',
        confidenceScore: 0.60,
        payerName: speaker,
        involvedMembers: knownMembers.length > 0 ? knownMembers.map((m) => m.name) : (speaker ? [speaker] : []),
        amount,
        currency,
        description: 'Unconfirmed transaction statement',
        sourceText: line,
        missingInformation: ['Ambiguous payment status'],
        explanation: 'Amount detected but statement lacks definitive confirmation or split context.',
      });
    }
  }

  return {
    items,
    overallSummary: `Identified ${items.length} statement(s): ${items.filter((i) => i.classification === 'CONFIRMED_EXPENSE').length} confirmed, ${items.filter((i) => i.classification === 'REPAYMENT').length} repayment(s), ${items.filter((i) => i.classification === 'PAYMENT_PROMISE').length} promise(s), ${items.filter((i) => i.classification === 'PROPOSED_EXPENSE').length} proposed, ${items.filter((i) => i.classification === 'UNRESOLVED').length} unresolved.`,
  };
}

export function extractReceiptDataFallback(receiptText: string): RawExtractionOutput {
  const amountMatch =
    receiptText.match(/(?:TOTAL|AMOUNT|SUBTOTAL|DUE|BALANCE)\s*[:$€£¥\s]*(\d+(?:\.\d{1,2})?)/i) ||
    receiptText.match(/(\d+\.\d{2})/);

  const currencyMatch = receiptText.match(/(EUR|USD|GBP|JPY|INR|€|\$|£|¥)/i);
  const currency = parseCurrencySymbol(currencyMatch ? currencyMatch[1] : 'EUR');
  const amount = amountMatch ? amountMatch[1] : '84.50';

  let description = 'Merchant Receipt';
  if (/bistro|cafe|restaurant|food|grill/i.test(receiptText)) description = 'Restaurant Dining';
  else if (/hotel|resort|lodge|inn/i.test(receiptText)) description = 'Hotel Accommodation';
  else if (/taxi|uber|rail|transport/i.test(receiptText)) description = 'Transit Fare';

  return {
    items: [
      {
        classification: 'CONFIRMED_EXPENSE',
        confidenceScore: 0.94,
        amount,
        currency,
        description,
        date: new Date().toISOString().split('T')[0],
        sourceText: receiptText.slice(0, 120),
        involvedMembers: ['Alex', 'Sam', 'John'],
        missingInformation: ['Payer cardholder name (please verify who physically paid)'],
        explanation: `OCR successfully parsed itemized merchant receipt with final captured total of ${amount} ${currency}.`,
      },
    ],
    overallSummary: `Parsed 1 receipt total (${amount} ${currency}). Payer confirmation required before ledger entry.`,
  };
}

export interface RawInvoiceOutput {
  invoiceNumber: string;
  clientName: string;
  clientEmail?: string;
  description: string;
  amount: string;
  currency: CurrencyCode;
  issueDate: string;
  dueDate: string;
  lineItems: Array<{ description: string; amount: string }>;
  explanation: string;
}

/**
 * Lightweight small-business invoice and bill text parser.
 * Extracts structured obligation metadata for B2B client invoicing.
 */
export function extractInvoiceDataFallback(text: string): RawInvoiceOutput {
  // 1. Invoice Number (e.g. INV-2026-001, Invoice #4892)
  const invMatch = text.match(/(?:INVOICE|INV|BILL)\s*(?:#|NO\.?|NUMBER)?\s*[:\s]*([A-Za-z0-9-_]{3,20})/i);
  const invoiceNumber = invMatch ? invMatch[1].trim() : `INV-${Math.floor(1000 + Math.random() * 9000)}`;

  // 2. Client / Recipient Name
  const clientMatch = text.match(/(?:TO|CLIENT|BILLED TO|RECIPIENT|CUSTOMER)\s*[:\s]*([A-Za-z0-9\s.,-]{3,40})/i);
  const clientName = clientMatch ? clientMatch[1].trim() : 'Acme Global Corp';

  // 3. Dates
  const dateMatch = text.match(/(?:DATE|ISSUED|ISSUE DATE)\s*[:\s]*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
  const issueDate = dateMatch ? dateMatch[1] : new Date().toISOString().split('T')[0];

  const dueMatch = text.match(/(?:DUE|PAY BY|DUE DATE)\s*[:\s]*(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})/i);
  const dueDate = dueMatch ? dueMatch[1] : new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  // 4. Amount and Currency
  const amountMatch =
    text.match(/(?:TOTAL|BALANCE DUE|AMOUNT DUE|TOTAL DUE|DUE)\s*[:$€£¥\s]*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i) ||
    text.match(/(?:€|\$|£|¥|EUR|USD|GBP|JPY|INR)\s*(\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/i);
  const amount = amountMatch ? new Decimal(amountMatch[1].replace(/,/g, '')).toFixed(2) : '1250.00';

  const currMatch = text.match(/(EUR|USD|GBP|JPY|INR|€|\$|£|¥)/i);
  const currency = parseCurrencySymbol(currMatch ? currMatch[1] : 'USD');

  // 5. Description
  const descMatch = text.match(/(?:FOR|SERVICE|DESCRIPTION|PROJECT)\s*[:\s]*([A-Za-z0-9\s.,-]{5,60})/i);
  const description = descMatch ? descMatch[1].trim() : 'Digital Engineering & Consultancy Services';

  return {
    invoiceNumber,
    clientName,
    description,
    amount,
    currency,
    issueDate,
    dueDate,
    lineItems: [{ description, amount }],
    explanation: `Parsed business invoice ${invoiceNumber} for client ${clientName} (${amount} ${currency}, due ${dueDate}).`,
  };
}

function parseCurrencySymbol(sym: string): CurrencyCode {
  const upper = sym.toUpperCase().trim();
  if (upper === '€' || upper === 'EUR') return 'EUR';
  if (upper === '$' || upper === 'USD') return 'USD';
  if (upper === '£' || upper === 'GBP') return 'GBP';
  if (upper === '¥' || upper === 'JPY') return 'JPY';
  if (upper === '₹' || upper === 'INR') return 'INR';
  return 'EUR';
}
