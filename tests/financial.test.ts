import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import {
  formatCurrencyAmount,
  getCurrencyDecimals,
  quantizeCurrency,
  splitAmountEqually,
  toDecimal,
  validateCustomSplits,
} from '../server/financial/currency';
import { convertCurrency, getReferenceExchangeRate } from '../server/financial/rates';
import { calculateGroupBalances } from '../server/financial/balances';
import { CurrencyCode, GroupMember, Expense } from '../server/types';

describe('Financial Engine & Currency Math', () => {
  it('correctly reports ISO 4217 minor unit decimals', () => {
    expect(getCurrencyDecimals('EUR')).toBe(2);
    expect(getCurrencyDecimals('USD')).toBe(2);
    expect(getCurrencyDecimals('GBP')).toBe(2);
    expect(getCurrencyDecimals('INR')).toBe(2);
    expect(getCurrencyDecimals('JPY')).toBe(0); // Zero decimal currency
  });

  it('quantizes currencies to exact minor units with ROUND_HALF_UP', () => {
    expect(quantizeCurrency('10.555', 'EUR').toString()).toBe('10.56');
    expect(quantizeCurrency('10.554', 'EUR').toString()).toBe('10.55');
    // JPY has 0 decimals
    expect(quantizeCurrency('1250.6', 'JPY').toString()).toBe('1251');
    expect(quantizeCurrency('1250.4', 'JPY').toString()).toBe('1250');
  });

  it('splits amounts equally with ZERO lost pennies / minor units', () => {
    // €100.00 split 3 ways: 33.34, 33.33, 33.33 => sum is EXACTLY 100.00
    const sharesEUR = splitAmountEqually('100.00', 'EUR', 3);
    expect(sharesEUR).toEqual(['33.34', '33.33', '33.33']);
    const sumEUR = sharesEUR.reduce((acc, val) => acc.plus(new Decimal(val)), new Decimal(0));
    expect(sumEUR.toString()).toBe('100');

    // JPY ¥10,000 split 3 ways: 3334, 3333, 3333 => sum is EXACTLY 10000
    const sharesJPY = splitAmountEqually('10000', 'JPY', 3);
    expect(sharesJPY).toEqual(['3334', '3333', '3333']);
    const sumJPY = sharesJPY.reduce((acc, val) => acc.plus(new Decimal(val)), new Decimal(0));
    expect(sumJPY.toString()).toBe('10000');
  });

  it('validates custom splits correctly', () => {
    const valid = validateCustomSplits('100.00', 'EUR', ['40.00', '35.00', '25.00']);
    expect(valid.isValid).toBe(true);
    expect(valid.difference).toBe('0.00');

    const invalid = validateCustomSplits('100.00', 'EUR', ['40.00', '35.00', '20.00']);
    expect(invalid.isValid).toBe(false);
    expect(invalid.difference).toBe('5.00');
  });

  it('handles exchange-rate direction and preserves rate provenance', () => {
    const convEURtoUSD = convertCurrency('100.00', 'EUR', 'USD');
    expect(convEURtoUSD.fromAmount).toBe('100');
    expect(convEURtoUSD.fromCurrency).toBe('EUR');
    expect(convEURtoUSD.toCurrency).toBe('USD');
    expect(convEURtoUSD.toAmount).toBe('108.50');
    expect(convEURtoUSD.rateDirection).toBe('EUR_TO_USD');
    expect(convEURtoUSD.rateSource).toBe('ECB_DAILY_REFERENCE_RATES');

    // Reverse conversion: USD to EUR
    const convUSDtoEUR = convertCurrency('108.50', 'USD', 'EUR');
    expect(convUSDtoEUR.fromAmount).toBe('108.5');
    expect(convUSDtoEUR.toCurrency).toBe('EUR');
    expect(convUSDtoEUR.toAmount).toBe('100.00');
  });

  it('enforces mathematical zero-sum invariant across group balances', () => {
    const members: GroupMember[] = [
      { id: 'm1', groupId: 'g1', name: 'Alex', country: 'Germany', preferredCurrency: 'EUR', email: 'a@ex.com', createdAt: '' },
      { id: 'm2', groupId: 'g1', name: 'Sam', country: 'USA', preferredCurrency: 'USD', email: 's@ex.com', createdAt: '' },
      { id: 'm3', groupId: 'g1', name: 'John', country: 'Japan', preferredCurrency: 'JPY', email: 'j@ex.com', createdAt: '' },
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        groupId: 'g1',
        payerId: 'm1',
        description: 'Hotel',
        category: 'Accommodation',
        originalAmount: '300.00',
        originalCurrency: 'EUR',
        baseAmount: '300.00',
        exchangeRate: '1.00000000',
        rateSource: 'PARITY',
        rateTimestamp: '',
        rateDirection: 'BASE_TO_ORIGINAL',
        splitType: 'EQUAL',
        evidenceType: 'MANUAL',
        status: 'APPROVED',
        createdAt: '',
        splits: [
          { id: 's1', expenseId: 'e1', memberId: 'm1', shareAmount: '100.00', shareBaseAmount: '100.00' },
          { id: 's2', expenseId: 'e1', memberId: 'm2', shareAmount: '100.00', shareBaseAmount: '100.00' },
          { id: 's3', expenseId: 'e1', memberId: 'm3', shareAmount: '100.00', shareBaseAmount: '100.00' },
        ],
      },
    ];

    const result = calculateGroupBalances({
      baseCurrency: 'EUR',
      members,
      expenses,
    });

    expect(result.isBalanced).toBe(true);
    expect(result.discrepancyBase).toBe('0.00');

    // Alex paid 300, owes 100 => net +200
    // Sam paid 0, owes 100 => net -100
    // John paid 0, owes 100 => net -100
    // Sum: 200 - 100 - 100 = 0
    const alex = result.balances.find((b) => b.memberId === 'm1');
    const sam = result.balances.find((b) => b.memberId === 'm2');
    const john = result.balances.find((b) => b.memberId === 'm3');

    expect(alex?.netInBase).toBe('200.00');
    expect(sam?.netInBase).toBe('-100.00');
    expect(john?.netInBase).toBe('-100.00');
  });
});
