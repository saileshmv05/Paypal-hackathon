import { describe, it, expect } from 'vitest';
import { extractExpensesFromConversationFallback, extractReceiptDataFallback } from '../server/ai/classifier';
import { GroupMember } from '../server/types';

describe('AI Expense Intelligence Classifier', () => {
  const members: GroupMember[] = [
    { id: 'm1', groupId: 'g1', name: 'Alex', country: 'Germany', preferredCurrency: 'EUR', email: 'alex@ex.com', createdAt: '' },
    { id: 'm2', groupId: 'g1', name: 'Sam', country: 'USA', preferredCurrency: 'USD', email: 'sam@ex.com', createdAt: '' },
    { id: 'm3', groupId: 'g1', name: 'John', country: 'Japan', preferredCurrency: 'JPY', email: 'john@ex.com', createdAt: '' },
  ];

  it('correctly classifies CONFIRMED_EXPENSE vs REPAYMENT vs PAYMENT_PROMISE vs UNRESOLVED', () => {
    const convo = `
Alex: I paid €450 for the hotel.
Sam: I'll send you €150.
John: I already transferred €100 yesterday.
Alex: Dinner was another €75.
Sam: Wait, John was supposed to cover dinner.
    `;

    const result = extractExpensesFromConversationFallback(convo, members);
    expect(result.items.length).toBe(4);

    const hotel = result.items.find((i) => i.description.toLowerCase().includes('hotel'));
    expect(hotel?.classification).toBe('CONFIRMED_EXPENSE');
    expect(hotel?.amount).toBe('450');
    expect(hotel?.currency).toBe('EUR');
    expect(hotel?.payerName).toBe('Alex');

    const promise = result.items.find((i) => i.classification === 'PAYMENT_PROMISE');
    expect(promise).toBeDefined();
    expect(promise?.amount).toBe('150');
    expect(promise?.payerName).toBe('Sam');

    const repayment = result.items.find((i) => i.classification === 'REPAYMENT');
    expect(repayment).toBeDefined();
    expect(repayment?.amount).toBe('100');
    expect(repayment?.payerName).toBe('John');

    const dispute = result.items.find((i) => i.classification === 'UNRESOLVED');
    expect(dispute).toBeDefined();
    expect(dispute?.missingInformation.length).toBeGreaterThan(0);
  });

  it('parses merchant receipt data and flags required payer verification', () => {
    const receiptText = `
      BISTRO DE TOKYO
      Date: 2026-11-03
      Item 1: Wagyu Steak €42.50
      Item 2: Red Wine €42.00
      TOTAL: €84.50
      VISA ENDING 4921
    `;

    const result = extractReceiptDataFallback(receiptText);
    expect(result.items.length).toBe(1);
    expect(result.items[0].classification).toBe('CONFIRMED_EXPENSE');
    expect(result.items[0].amount).toBe('84.50');
    expect(result.items[0].currency).toBe('EUR');
    expect(result.items[0].missingInformation).toContain('Payer cardholder name (please verify who physically paid)');
  });
});
