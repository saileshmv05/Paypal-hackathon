import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { calculateExpenseSplits } from '../server/financial/splits';

describe('Financial Engine: Deterministic Expense Splitting & Precision Invariants', () => {
  it('EQUAL split distributes remainder pennies with zero lost minor units', () => {
    // €100.00 split among 3 people: exactly €33.34, €33.33, €33.33
    const result = calculateExpenseSplits({
      totalAmount: '100.00',
      currency: 'EUR',
      splitType: 'EQUAL',
      participants: [{ memberId: 'm1' }, { memberId: 'm2' }, { memberId: 'm3' }],
    });

    expect(result.length).toBe(3);
    expect(result[0].shareAmount).toBe('33.34');
    expect(result[1].shareAmount).toBe('33.33');
    expect(result[2].shareAmount).toBe('33.33');

    // Invariant: sum of shares === 100.00
    const sum = result.reduce((acc, curr) => acc.plus(new Decimal(curr.shareAmount)), new Decimal(0));
    expect(sum.toFixed(2)).toBe('100.00');
  });

  it('EQUAL split handles zero-decimal currencies (JPY) without fractional amounts', () => {
    // ¥10,000 split among 3 people: ¥3334, ¥3333, ¥3333
    const result = calculateExpenseSplits({
      totalAmount: '10000',
      currency: 'JPY',
      splitType: 'EQUAL',
      participants: [{ memberId: 'm1' }, { memberId: 'm2' }, { memberId: 'm3' }],
    });

    expect(result.length).toBe(3);
    expect(result[0].shareAmount).toBe('3334');
    expect(result[1].shareAmount).toBe('3333');
    expect(result[2].shareAmount).toBe('3333');

    const sum = result.reduce((acc, curr) => acc.plus(new Decimal(curr.shareAmount)), new Decimal(0));
    expect(sum.toFixed(0)).toBe('10000');
  });

  it('EXACT split validates allocations and succeeds when sum matches total exactly', () => {
    const result = calculateExpenseSplits({
      totalAmount: '250.50',
      currency: 'USD',
      splitType: 'EXACT',
      participants: [
        { memberId: 'm1', amount: '120.25' },
        { memberId: 'm2', amount: '80.00' },
        { memberId: 'm3', amount: '50.25' },
      ],
    });

    expect(result.length).toBe(3);
    expect(result[0].shareAmount).toBe('120.25');
    expect(result[1].shareAmount).toBe('80.00');
    expect(result[2].shareAmount).toBe('50.25');

    const sum = result.reduce((acc, curr) => acc.plus(new Decimal(curr.shareAmount)), new Decimal(0));
    expect(sum.toFixed(2)).toBe('250.50');
  });

  it('EXACT split strictly rejects allocations when sum does not equal total', () => {
    expect(() => {
      calculateExpenseSplits({
        totalAmount: '200.00',
        currency: 'EUR',
        splitType: 'EXACT',
        participants: [
          { memberId: 'm1', amount: '100.00' },
          { memberId: 'm2', amount: '80.00' }, // Sum is 180.00, short by 20.00
        ],
      });
    }).toThrow(/does not equal expense total/i);
  });

  it('PERCENT split validates 100% sum and allocates remainder pennies without loss', () => {
    // €300.00 split 50%, 30%, 20%
    const result = calculateExpenseSplits({
      totalAmount: '300.00',
      currency: 'EUR',
      splitType: 'PERCENT',
      participants: [
        { memberId: 'm1', percentage: 50 },
        { memberId: 'm2', percentage: 30 },
        { memberId: 'm3', percentage: 20 },
      ],
    });

    expect(result[0].shareAmount).toBe('150.00');
    expect(result[1].shareAmount).toBe('90.00');
    expect(result[2].shareAmount).toBe('60.00');

    const sum = result.reduce((acc, curr) => acc.plus(new Decimal(curr.shareAmount)), new Decimal(0));
    expect(sum.toFixed(2)).toBe('300.00');
  });

  it('PERCENT split strictly rejects invalid percentages that do not sum to 100%', () => {
    expect(() => {
      calculateExpenseSplits({
        totalAmount: '150.00',
        currency: 'EUR',
        splitType: 'PERCENT',
        participants: [
          { memberId: 'm1', percentage: 40 },
          { memberId: 'm2', percentage: 40 }, // Sum is 80%
        ],
      });
    }).toThrow(/must sum to 100%/i);
  });

  it('rejects duplicate participants and negative amounts', () => {
    expect(() => {
      calculateExpenseSplits({
        totalAmount: '-50.00',
        currency: 'EUR',
        splitType: 'EQUAL',
        participants: [{ memberId: 'm1' }],
      });
    }).toThrow(/strictly positive/i);

    expect(() => {
      calculateExpenseSplits({
        totalAmount: '100.00',
        currency: 'EUR',
        splitType: 'EQUAL',
        participants: [{ memberId: 'm1' }, { memberId: 'm1' }],
      });
    }).toThrow(/duplicate participant/i);
  });
});
