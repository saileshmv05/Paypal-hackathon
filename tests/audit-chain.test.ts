import { describe, it, expect, beforeEach } from 'vitest';
import { db, initDatabase } from '../server/db/database';
import { seedDatabase } from '../server/seed';
import { recordAuditEvent, verifyAuditChain, computeEventHash } from '../server/audit/chain';

describe('Cryptographic Audit Chain (Tamper-Evident Ledger)', () => {
  beforeEach(() => {
    seedDatabase();
  });

  it('successfully validates the seeded cryptographic audit chain', () => {
    const groupResult = verifyAuditChain('group-intl-trip-2026');
    expect(groupResult.isValid).toBe(true);
    expect(groupResult.totalEvents).toBeGreaterThanOrEqual(5);
    expect(groupResult.brokenAtIndex).toBeNull();

    const workspaceResult = verifyAuditChain('workspace-agency-demo');
    expect(workspaceResult.isValid).toBe(true);
    expect(workspaceResult.totalEvents).toBeGreaterThanOrEqual(2);
    expect(workspaceResult.brokenAtIndex).toBeNull();
  });

  it('records new events linked to previous hash and preserves chain validity', () => {
    const groupId = 'group-intl-trip-2026';
    const beforeResult = verifyAuditChain(groupId);
    expect(beforeResult.isValid).toBe(true);

    const newEvent = recordAuditEvent({
      groupId,
      entityType: 'TEST_ENTITY',
      entityId: 'test-123',
      eventType: 'SYSTEM_TEST_EVENT',
      actor: 'SecurityAuditor',
      description: 'Audit block verification test',
      metadata: { securityLevel: 'HIGH', testPassed: true },
    });

    expect(newEvent.hash).toBeDefined();
    expect(newEvent.prevHash).toBeDefined();

    const afterResult = verifyAuditChain(groupId);
    expect(afterResult.isValid).toBe(true);
    expect(afterResult.totalEvents).toBe(beforeResult.totalEvents + 1);
  });

  it('detects tampering immediately when an attacker alters an event payload in database', () => {
    const groupId = 'group-intl-trip-2026';
    const initialCheck = verifyAuditChain(groupId);
    expect(initialCheck.isValid).toBe(true);

    // Retrieve the second event in the chain
    const events: any[] = db
      .prepare('SELECT * FROM audit_events WHERE group_id = ? ORDER BY created_at ASC')
      .all(groupId);
    expect(events.length).toBeGreaterThan(2);

    const targetEvent = events[1];
    const originalDescription = targetEvent.description;

    // Direct malicious database modification (tampering with financial ledger)
    db.prepare('UPDATE audit_events SET description = ? WHERE id = ?').run(
      'MALICIOUS MODIFICATION: Embezzled $10,000 without trace',
      targetEvent.id
    );

    // Cryptographic verification must catch the tamper
    const tamperedCheck = verifyAuditChain(groupId);
    expect(tamperedCheck.isValid).toBe(false);
    expect(tamperedCheck.brokenAtIndex).toBe(1);
    expect(tamperedCheck.errors.length).toBeGreaterThan(0);
    expect(tamperedCheck.errors[0]).toContain('Tampered content detected');

    // Restore original description
    db.prepare('UPDATE audit_events SET description = ? WHERE id = ?').run(
      originalDescription,
      targetEvent.id
    );

    const restoredCheck = verifyAuditChain(groupId);
    expect(restoredCheck.isValid).toBe(true);
  });
});
