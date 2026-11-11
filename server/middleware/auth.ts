import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { db } from '../db/database';
import { UserContext } from '../types';

export interface AuthenticatedRequest extends Request {
  user?: UserContext;
  token?: string;
}

export interface DemoPersona {
  id: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MEMBER' | 'OWNER';
  groupIds: string[];
  workspaceIds: string[];
  description: string;
}

export const DEMO_PERSONAS: Record<string, DemoPersona> = {
  'alex-organizer': {
    id: 'user-alex-admin',
    name: 'Alex (Trip Organizer & Admin)',
    email: 'alex.munich@example.com',
    role: 'ADMIN',
    groupIds: ['group-intl-trip-2026'],
    workspaceIds: ['workspace-agency-demo'],
    description: 'Full administrative access across personal group & agency workspace',
  },
  'sam-member': {
    id: 'user-sam-member',
    name: 'Sam (Travel Participant)',
    email: 'sam.sanfrancisco@example.com',
    role: 'MEMBER',
    groupIds: ['group-intl-trip-2026'],
    workspaceIds: [], // Strictly no business workspace access!
    description: 'Regular participant in group-intl-trip-2026; no workspace access',
  },
  'agency-owner': {
    id: 'user-agency-owner',
    name: 'Elena (Apex Agency Owner)',
    email: 'elena@apexcreative.agency',
    role: 'OWNER',
    groupIds: [], // Strictly no personal travel group access!
    workspaceIds: ['workspace-agency-demo'],
    description: 'Business workspace owner with invoice management rights',
  },
  'guest-unauthorized': {
    id: 'user-guest-unauthorized',
    name: 'Unauthorized Stranger',
    email: 'unauthorized@attacker.org',
    role: 'MEMBER',
    groupIds: ['group-unrelated-foreign'],
    workspaceIds: ['workspace-unrelated-foreign'],
    description: 'External unauthorized user to test IDOR access controls',
  },
};

// Cryptographically generated session token store
interface SessionRecord {
  token: string;
  user: UserContext;
  createdAt: number;
  expiresAt: number;
}

const activeSessions = new Map<string, SessionRecord>();

// Password hashing utilities using Node.js crypto (timing-safe scrypt)
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derived = crypto.scryptSync(password, salt, 64);
    return crypto.timingSafeEqual(keyBuffer, derived);
  } catch {
    return false;
  }
}

// Clean expired sessions periodically
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export function createUserSession(user: { id: string; name: string; email: string; role?: string }): {
  token: string;
  user: UserContext;
  expiresAt: string;
} {
  const token = `cs_${crypto.randomBytes(32).toString('hex')}`;
  const now = Date.now();
  const expiresAtMs = now + SESSION_TTL_MS;

  const memberGroups: any[] = db
    .prepare('SELECT group_id FROM group_members WHERE email = ? OR id = ?')
    .all(user.email, user.id);
  const groupIds = memberGroups.map((g) => g.group_id);

  const userWorkspaces: any[] = db
    .prepare('SELECT id FROM workspaces WHERE owner_id = ?')
    .all(user.id);
  const workspaceIds = userWorkspaces.map((w) => w.id);

  const userContext: UserContext = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: (user.role as any) || 'MEMBER',
    groupIds,
    workspaceIds,
  };

  activeSessions.set(token, {
    token,
    user: userContext,
    createdAt: now,
    expiresAt: expiresAtMs,
  });

  return {
    token,
    user: userContext,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export function createSession(personaKey: string): { token: string; user: UserContext; expiresAt: string } {
  const persona = DEMO_PERSONAS[personaKey];
  if (!persona) {
    throw new Error(`Unknown persona: ${personaKey}. Available: ${Object.keys(DEMO_PERSONAS).join(', ')}`);
  }

  // Generate cryptographically strong unguessable random token (256-bit entropy)
  const token = `cs_${crypto.randomBytes(32).toString('hex')}`;
  const now = Date.now();
  const expiresAtMs = now + SESSION_TTL_MS;

  const userContext: UserContext = {
    id: persona.id,
    name: persona.name,
    email: persona.email,
    role: persona.role,
    groupIds: [...persona.groupIds],
    workspaceIds: [...persona.workspaceIds],
  };

  activeSessions.set(token, {
    token,
    user: userContext,
    createdAt: now,
    expiresAt: expiresAtMs,
  });

  return {
    token,
    user: userContext,
    expiresAt: new Date(expiresAtMs).toISOString(),
  };
}

export function getSession(token: string): UserContext | null {
  if (!token) return null;
  const session = activeSessions.get(token);
  if (!session) return null;

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return null;
  }

  // Dynamic refresh for user's created/joined groups and workspaces
  if (
    session.user.id &&
    !session.user.id.startsWith('user-alex') &&
    !session.user.id.startsWith('user-sam') &&
    !session.user.id.startsWith('user-agency')
  ) {
    try {
      const memberGroups: any[] = db
        .prepare('SELECT group_id FROM group_members WHERE email = ? OR id = ?')
        .all(session.user.email, session.user.id);
      const userWorkspaces: any[] = db
        .prepare('SELECT id FROM workspaces WHERE owner_id = ?')
        .all(session.user.id);
      session.user.groupIds = Array.from(new Set([...memberGroups.map((g) => g.group_id)]));
      session.user.workspaceIds = Array.from(new Set([...userWorkspaces.map((w) => w.id)]));
    } catch {
      // Ignore fallback if table is locking
    }
  }

  return session.user;
}

export function destroySession(token: string): boolean {
  return activeSessions.delete(token);
}

export function clearAllSessions(): void {
  activeSessions.clear();
}

/**
 * Authentication Middleware:
 * Inspects Authorization: Bearer <token> or x-session-token.
 * NEVER trusts unverified client headers like x-user-role or x-user-id.
 * Fails closed: unauthenticated requests have req.user = undefined.
 */
export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (typeof req.headers['x-session-token'] === 'string') {
    token = req.headers['x-session-token'];
  }

  if (token) {
    const user = getSession(token);
    if (user) {
      req.user = user;
      req.token = token;
    }
  }

  // Fail closed: req.user is undefined if no valid session token was presented
  next();
}

/**
 * Ensures the request is authenticated with a valid session token.
 */
export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required. Please authenticate via a valid session token.',
      code: 'UNAUTHENTICATED',
    });
  }
  next();
}

/**
 * Authorization Guard:
 * Ensures the authenticated user has legitimate access to the requested personal group.
 * Prevents Insecure Direct Object References (IDOR).
 */
export function requireGroupAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required to access group resources.',
      code: 'UNAUTHENTICATED',
    });
  }

  const groupId = req.params.groupId || req.params.id || req.body?.groupId;

  if (!groupId) {
    return next();
  }

  // Check if group exists in database
  const group = db.prepare('SELECT id FROM groups WHERE id = ?').get(groupId);
  if (!group) {
    return res.status(404).json({ error: `Group ${groupId} does not exist.` });
  }

  // Admins have access to all demo groups
  if (req.user.role === 'ADMIN') {
    return next();
  }

  // Check if user has explicit membership
  const isMemberInDb = db
    .prepare('SELECT id FROM group_members WHERE group_id = ? AND (email = ? OR id = ?)')
    .get(groupId, req.user.email, req.user.id);
  const isCreatorInDb = db
    .prepare('SELECT id FROM groups WHERE id = ? AND created_by = ?')
    .get(groupId, req.user.id);

  if (!isMemberInDb && !isCreatorInDb && !req.user.groupIds.includes(groupId)) {
    return res.status(403).json({
      error: 'Access denied: You do not have permission to view or modify this group ledger.',
      code: 'FORBIDDEN_GROUP_ACCESS',
    });
  }

  next();
}

/**
 * Authorization Guard for Small Business Workspaces
 */
export function requireWorkspaceAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required to access business workspace resources.',
      code: 'UNAUTHENTICATED',
    });
  }

  const workspaceId = req.params.workspaceId || req.params.id || req.body?.workspaceId;

  if (!workspaceId) {
    return next();
  }

  const workspace = db.prepare('SELECT id FROM workspaces WHERE id = ?').get(workspaceId);
  if (!workspace) {
    return res.status(404).json({ error: `Workspace ${workspaceId} not found.` });
  }

  const isOwnerInDb = db
    .prepare('SELECT id FROM workspaces WHERE id = ? AND owner_id = ?')
    .get(workspaceId, req.user.id);

  if (req.user.role === 'ADMIN' || isOwnerInDb || req.user.workspaceIds.includes(workspaceId)) {
    return next();
  }

  return res.status(403).json({
    error: 'Access denied: You do not have permission to view or manage this business workspace.',
    code: 'FORBIDDEN_WORKSPACE_ACCESS',
  });
}

/**
 * Administrative Protection Guard for critical endpoints (e.g. demo reset)
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required for administrative operations.',
      code: 'UNAUTHENTICATED',
    });
  }

  const adminSecret = process.env.ADMIN_SECRET;
  const providedSecret = req.headers['x-admin-secret'];

  // If ADMIN_SECRET is configured, enforce strict token matching
  if (adminSecret && adminSecret.trim() !== '') {
    if (providedSecret !== adminSecret) {
      return res.status(403).json({ error: 'Administrative secret required for this operation.' });
    }
  }

  if (req.user.role !== 'ADMIN') {
    return res.status(403).json({
      error: 'Administrator role required for this operation.',
      code: 'FORBIDDEN_ADMIN_REQUIRED',
    });
  }

  next();
}
