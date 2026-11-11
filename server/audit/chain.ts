import crypto from 'crypto';
import { db } from '../db/database';
import { AuditEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';

export const GENESIS_HASH = '0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Deterministically serializes metadata with sorted keys for tamper-evident hashing.
 */
export function canonicalizeMetadata(obj: any): string {
  if (obj === null || obj === undefined) return '';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalizeMetadata).join(',') + ']';
  }
  const sortedKeys = Object.keys(obj).sort();
  const pairs = sortedKeys.map((k) => `${JSON.stringify(k)}:${canonicalizeMetadata(obj[k])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Computes a deterministic SHA-256 hash for an audit event block, including canonical metadata.
 */
export function computeEventHash(params: {
  id: string;
  groupId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  actor: string;
  description: string;
  metadata?: Record<string, any>;
  prevHash: string;
  createdAt: string;
}): string {
  const canonicalMeta = canonicalizeMetadata(params.metadata || {});
  const payload = [
    params.id,
    params.groupId,
    params.entityType,
    params.entityId,
    params.eventType,
    params.actor,
    params.description,
    canonicalMeta,
    params.prevHash,
    params.createdAt,
  ].join('|');

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

/**
 * Records a tamper-evident audit event cryptographically linked to the previous event block.
 * Note: Tamper-evident logging protects against undetected modifications within the ledger,
 * but does not constitute an immutable distributed blockchain against full database rewrites.
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
    metadata,
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
 * - Modified metadata (metadata hash mismatch)
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

    // 2. Parse metadata and recalculate event hash
    let parsedMetadata = {};
    try {
      parsedMetadata = typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata || {};
    } catch {
      parsedMetadata = {};
    }

    const computed = computeEventHash({
      id: e.id,
      groupId: e.group_id,
      entityType: e.entity_type,
      entityId: e.entity_id,
      eventType: e.event_type,
      actor: e.actor,
      description: e.description,
      metadata: parsedMetadata,
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
