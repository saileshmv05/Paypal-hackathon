import { describe, it, expect } from 'vitest';
import { extractExpensesFromConversationFallback, extractInvoiceDataFallback } from '../server/ai/classifier';
import { GroupMember } from '../server/types';

describe('Advanced Contextual AI Extraction & Duplicate Guard', () => {
  const members: GroupMember[] = [
    { id: 'm-1', groupId: 'g-1', name: 'Alex', country: 'DE', preferredCurrency: 'EUR', email: 'alex@example.com', createdAt: '' },
    { id: 'm-2', groupId: 'g-1', name: 'Sam', country: 'US', preferredCurrency: 'USD', email: 'sam@example.com', createdAt: '' },
    { id: 'm-3', groupId: 'g-1', name: 'Kenji', country: 'JP', preferredCurrency: 'JPY', email: 'kenji@example.com', createdAt: '' },
  ];

  it('recognizes contextual member exclusion across multiple chat messages', () => {
    const chat = [
      'Alex: I paid 300 EUR for the conference tickets.',
      'Sam: Split that equally between us.',
      'Alex: Actually, Kenji was not there for that session.',
    ].join('\n');

    const result = extractExpensesFromConversationFallback(chat, members);
    expect(result.items.length).toBeGreaterThanOrEqual(1);

    const expenseItem = result.items.find((i) => i.amount === '300' || i.amount === '300.00');
    expect(expenseItem).toBeDefined();
    expect(expenseItem?.payerName).toBe('Alex');
    // Kenji should be excluded from involved members based on contextual exclusion
    expect(expenseItem?.involvedMembers).toContain('Alex');
    expect(expenseItem?.involvedMembers).toContain('Sam');
    expect(expenseItem?.involvedMembers).not.toContain('Kenji');
  });

  it('identifies financial correction messages and flags isCorrection', () => {
    const correctionChat = 'Sam: I said 500 EUR earlier, but it was actually 420 EUR for the dinner.';
    const result = extractExpensesFromConversationFallback(correctionChat, members);

    expect(result.items.length).toBeGreaterThanOrEqual(1);
    const item = result.items[0];
    expect(item.amount).toBe('420');
    expect(item.isCorrection).toBe(true);
    expect(item.explanation.toLowerCase()).toContain('correction detected');
  });

  it('detects duplicate expenses when an identical amount and description was already recorded in ledger', () => {
    const existingExpenses = [
      { id: 'exp-existing-1', amount: '120.00', currency: 'EUR', description: 'Train tickets', payerName: 'Alex' },
    ];

    const input = 'Alex: I paid 120 EUR for Train tickets';
    const result = extractExpensesFromConversationFallback(input, members, existingExpenses);

    expect(result.items.length).toBe(1);
    const item = result.items[0];
    expect(item.isDuplicate).toBe(true);
    expect(item.duplicateOfId).toBe('exp-existing-1');
    expect(item.explanation.toLowerCase()).toContain('duplicate transaction');
  });

  it('extracts structured invoice data from vendor/client invoice text', () => {
    const invoiceText = `
      INVOICE #INV-2026-901
      Apex Creative Agency
      Client: Nordic Innovations Oy
      Date: 2026-11-01
      Due Date: 2026-12-01
      Description: Cloud Infrastructure & UX Design Sprint
      Total Due: €3,500.00 EUR
    `;

    const result = extractInvoiceDataFallback(invoiceText);
    expect(result.amount).toBe('3500.00');
    expect(result.currency).toBe('EUR');
    expect(result.invoiceNumber).toBe('INV-2026-901');
    expect(result.clientName).toContain('Nordic Innovations');
    expect(result.description).toContain('Cloud Infrastructure');
  });
});
