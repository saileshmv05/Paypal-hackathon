import crypto from 'crypto';
import { db } from '../db/database';
import { AuditEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Computes a deterministic SHA-256 hash for an audit event block
 */
export function computeEventHash(params: {
  id: string;
  groupId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  actor: string;
  description: string;
  prevHash: string;
  createdAt: string;
}): string {
  const payload = [
    params.id,
    params.groupId,
    params.entityType,
    params.entityId,
    params.eventType,
    params.actor,
    params.description,
    params.prevHash,
    params.createdAt,
  ].join('|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Records an immutable, tamper-evident audit event cryptographically linked to the previous event.
 */
export function recordAuditEvent(params: {
  groupId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  actor: string;
  description: string;
  metadata?: Record<string, any>;
}): AuditEvent {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  const metadata = params.metadata || {};

  // Find the most recent event's hash for this group/workspace
  const lastEvent: any = db
    .prepare('SELECT hash FROM audit_events WHERE group_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1')
    .get(params.groupId);

  const prevHash = lastEvent && lastEvent.hash ? lastEvent.hash : GENESIS_HASH;

  const hash = computeEventHash({
    id,
    groupId: params.groupId,
    entityType: params.entityType,
    entityId: params.entityId,
    eventType: params.eventType,
    actor: params.actor,
    description: params.description,
    prevHash,
    createdAt,
  });

  db.prepare(`
    INSERT INTO audit_events (
      id, group_id, entity_type, entity_id, event_type, actor, description, metadata, prev_hash, hash, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    params.groupId,
    params.entityType,
    params.entityId,
    params.eventType,
    params.actor,
    params.description,
    JSON.stringify(metadata),
    prevHash,
    hash,
    createdAt
  );

  return {
    id,
    groupId: params.groupId,
    entityType: params.entityType,
    entityId: params.entityId,
    eventType: params.eventType,
    actor: params.actor,
    description: params.description,
    metadata,
    prevHash,
    hash,
    createdAt,
  };
}

export interface AuditVerificationResult {
  isValid: boolean;
  totalEvents: number;
  verifiedAt: string;
  errors: string[];
  brokenAtIndex: number | null;
}

/**
 * Verifies the mathematical integrity of the cryptographic audit chain.
 * Detects:
 * - Modified events (hash mismatch)
 * - Deleted or missing events (chain link broken)
 * - Broken chronological order
 */
export function verifyAuditChain(groupId: string): AuditVerificationResult {
  const events: any[] = db
    .prepare('SELECT * FROM audit_events WHERE group_id = ? ORDER BY created_at ASC, rowid ASC')
    .all(groupId);

  const errors: string[] = [];
  let brokenAtIndex: number | null = null;
  let expectedPrevHash = GENESIS_HASH;

  for (let i = 0; i < events.length; i++) {
    const e = events[i];

    // 1. Verify previous hash linkage
    if (e.prev_hash !== expectedPrevHash) {
      if (brokenAtIndex === null) brokenAtIndex = i;
      errors.push(
        `Broken chain linkage at event ${e.id} (index ${i}): expected prev_hash ${expectedPrevHash}, found ${e.prev_hash}`
      );
    }

    // 2. Recalculate event hash and compare
    const computed = computeEventHash({
      id: e.id,
      groupId: e.group_id,
      entityType: e.entity_type,
      entityId: e.entity_id,
      eventType: e.event_type,
      actor: e.actor,
      description: e.description,
      prevHash: e.prev_hash,
      createdAt: e.created_at,
    });

    if (computed !== e.hash) {
      if (brokenAtIndex === null) brokenAtIndex = i;
      errors.push(
        `Tampered content detected in event ${e.id} (index ${i}): stored hash ${e.hash} does not match recalculated hash ${computed}`
      );
    }

    expectedPrevHash = e.hash;
  }

  return {
    isValid: errors.length === 0,
    totalEvents: events.length,
    verifiedAt: new Date().toISOString(),
    errors,
    brokenAtIndex,
  };
}
