import { describe, it, expect } from 'vitest';
import Decimal from 'decimal.js';
import { solveMinimumTransfersExact, generateMinTransfersSettlement } from '../server/optimizer/partition';
import { generateMinCostSettlement, estimateTransferFee } from '../server/optimizer/costModel';
import { GroupMember, ParticipantBalance } from '../server/types';

describe('Settlement Optimizer', () => {
  it('correctly solves the zero-sum partition relation (Min transfers = N - K)', () => {
    // 4 participants:
    // P1: +50, P2: -50  (Subset 1: zero sum!)
    // P3: +30, P4: -30  (Subset 2: zero sum!)
    // Total nonzero N = 4. Disjoint zero-sum subsets K = 2.
    // Minimum transfers MUST be 4 - 2 = 2 transfers!
    // A naive greedy approach might produce 3 transfers.
    const nodes = [
      { id: 'p1', name: 'P1', preferredCurrency: 'EUR' as const, balanceMinor: 5000n, netInBase: new Decimal('50.00') },
      { id: 'p2', name: 'P2', preferredCurrency: 'EUR' as const, balanceMinor: -5000n, netInBase: new Decimal('-50.00') },
      { id: 'p3', name: 'P3', preferredCurrency: 'EUR' as const, balanceMinor: 3000n, netInBase: new Decimal('30.00') },
      { id: 'p4', name: 'P4', preferredCurrency: 'EUR' as const, balanceMinor: -3000n, netInBase: new Decimal('-30.00') },
    ];

    const solution = solveMinimumTransfersExact(nodes, 'EUR', 'plan-test');
    expect(solution.zeroSumSubsetsCount).toBe(2);
    expect(solution.transfers.length).toBe(2);

    // Verify P2 pays P1 50, P4 pays P3 30
    const t1 = solution.transfers.find((t) => t.fromMemberId === 'p2' && t.toMemberId === 'p1');
    const t2 = solution.transfers.find((t) => t.fromMemberId === 'p4' && t.toMemberId === 'p3');
    expect(t1).toBeDefined();
    expect(t1?.amount).toBe('50.00');
    expect(t2).toBeDefined();
    expect(t2?.amount).toBe('30.00');
  });

  it('handles edge case: participants with zero balance are excluded from transfers', () => {
    const balances: ParticipantBalance[] = [
      { memberId: 'm1', memberName: 'Alice', preferredCurrency: 'EUR', netInBase: '100.00', netInPreferred: '100.00', totalPaidBase: '100', totalOwedBase: '0' },
      { memberId: 'm2', memberName: 'Bob', preferredCurrency: 'EUR', netInBase: '-100.00', netInPreferred: '-100.00', totalPaidBase: '0', totalOwedBase: '100' },
      { memberId: 'm3', memberName: 'Charlie', preferredCurrency: 'EUR', netInBase: '0.00', netInPreferred: '0.00', totalPaidBase: '50', totalOwedBase: '50' }, // Zero balance!
    ];

    const members: GroupMember[] = [
      { id: 'm1', groupId: 'g1', name: 'Alice', country: 'DE', preferredCurrency: 'EUR', email: 'a@e.com', createdAt: '' },
      { id: 'm2', groupId: 'g1', name: 'Bob', country: 'DE', preferredCurrency: 'EUR', email: 'b@e.com', createdAt: '' },
      { id: 'm3', groupId: 'g1', name: 'Charlie', country: 'DE', preferredCurrency: 'EUR', email: 'c@e.com', createdAt: '' },
    ];

    const plan = generateMinTransfersSettlement('g1', 'EUR', balances, members);
    expect(plan.transfers.length).toBe(1);
    expect(plan.transfers[0].fromMemberName).toBe('Bob');
    expect(plan.transfers[0].toMemberName).toBe('Alice');
    expect(plan.transfers[0].amount).toBe('100.00');
  });

  it('cost model accurately calculates domestic vs cross-border fee spreads', () => {
    // Domestic EUR -> EUR: 0% spread
    const domesticFee = estimateTransferFee(new Decimal('100.00'), 'EUR', 'EUR', 'EUR');
    expect(domesticFee.feeModel.isDomestic).toBe(true);
    expect(domesticFee.feeModel.estimatedFxSpreadPct).toBe('0.00');

    // Cross-border EUR -> USD: 2.5% spread + 1.5% international surcharge
    const crossBorderFee = estimateTransferFee(new Decimal('100.00'), 'EUR', 'USD', 'EUR');
    expect(crossBorderFee.feeModel.isDomestic).toBe(false);
    expect(crossBorderFee.feeModel.estimatedFxSpreadPct).toBe('2.50');
    // 0.45 fixed + 2.50 spread + 1.50 surcharge = 4.45
    expect(crossBorderFee.estimatedTotalFeeBase.toString()).toBe('4.45');
  });
});
