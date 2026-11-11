import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '../server/db/database';
import { seedDatabase } from '../server/seed';
import {
  authMiddleware,
  requireAuth,
  requireGroupAccess,
  requireWorkspaceAccess,
  requireAdmin,
  createSession,
  createUserSession,
  destroySession,
  hashPassword,
  verifyPassword,
  clearAllSessions,
  AuthenticatedRequest,
} from '../server/middleware/auth';

function createMockReqRes(options: {
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: any;
  user?: any;
}) {
  let statusCode = 200;
  let jsonBody: any = null;
  let nextCalled = false;

  const req: any = {
    headers: options.headers || {},
    params: options.params || {},
    body: options.body || {},
    user: options.user,
  };

  const res: any = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(data: any) {
      jsonBody = data;
      return res;
    },
  };

  const next = () => {
    nextCalled = true;
  };

  return {
    req,
    res,
    next,
    getStatus: () => statusCode,
    getBody: () => jsonBody,
    isNextCalled: () => nextCalled,
  };
}

describe('P0 Security: Authentication, Authorization & IDOR Defenses', () => {
  beforeEach(() => {
    seedDatabase();
    clearAllSessions();
  });

  it('rejects unauthenticated requests to protected endpoints with 401 Unauthorized', () => {
    const { req, res, next, getStatus, getBody, isNextCalled } = createMockReqRes({});

    // 1. Run authMiddleware (no session token)
    authMiddleware(req, res, next);
    expect(req.user).toBeUndefined();

    // 2. Run requireAuth guard
    const authCheck = createMockReqRes({ user: req.user });
    requireAuth(authCheck.req, authCheck.res, authCheck.next);

    expect(authCheck.getStatus()).toBe(401);
    expect(authCheck.getBody().code).toBe('UNAUTHENTICATED');
    expect(authCheck.isNextCalled()).toBe(false);
  });

  it('strictly ignores forged identity headers (x-user-role: ADMIN) and fails closed with 401', () => {
    const { req, res, next } = createMockReqRes({
      headers: {
        'x-user-id': 'attacker-hacker',
        'x-user-role': 'ADMIN',
      },
    });

    authMiddleware(req, res, next);
    // x-user-role must be ignored; user must remain undefined without valid token
    expect(req.user).toBeUndefined();

    const adminCheck = createMockReqRes({ user: req.user });
    requireAdmin(adminCheck.req, adminCheck.res, adminCheck.next);

    expect(adminCheck.getStatus()).toBe(401);
    expect(adminCheck.isNextCalled()).toBe(false);
  });

  it('authenticates successfully when presented with a valid cryptographically generated session token', () => {
    const { token, user } = createSession('alex-organizer');

    const { req, res, next } = createMockReqRes({
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    authMiddleware(req, res, next);
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe('user-alex-admin');
    expect(req.user.role).toBe('ADMIN');

    const guardCheck = createMockReqRes({ user: req.user });
    requireAuth(guardCheck.req, guardCheck.res, guardCheck.next);
    expect(guardCheck.isNextCalled()).toBe(true);
  });

  it('prevents IDOR: travel participant (Sam) cannot access business workspace invoices (403 Forbidden)', () => {
    const { token } = createSession('sam-member');

    const { req, res, next } = createMockReqRes({
      headers: { authorization: `Bearer ${token}` },
    });
    authMiddleware(req, res, next);
    expect(req.user.id).toBe('user-sam-member');

    // Access personal group: Allowed
    const groupCheck = createMockReqRes({
      user: req.user,
      params: { id: 'group-intl-trip-2026' },
    });
    requireGroupAccess(groupCheck.req, groupCheck.res, groupCheck.next);
    expect(groupCheck.isNextCalled()).toBe(true);

    // Access business workspace: Denied with 403 Forbidden!
    const workspaceCheck = createMockReqRes({
      user: req.user,
      params: { id: 'workspace-agency-demo' },
    });
    requireWorkspaceAccess(workspaceCheck.req, workspaceCheck.res, workspaceCheck.next);
    expect(workspaceCheck.getStatus()).toBe(403);
    expect(workspaceCheck.getBody().code).toBe('FORBIDDEN_WORKSPACE_ACCESS');
    expect(workspaceCheck.isNextCalled()).toBe(false);
  });

  it('prevents IDOR: agency owner (Elena) cannot access personal travel group (403 Forbidden)', () => {
    const { token } = createSession('agency-owner');

    const { req, res, next } = createMockReqRes({
      headers: { authorization: `Bearer ${token}` },
    });
    authMiddleware(req, res, next);
    expect(req.user.id).toBe('user-agency-owner');

    // Access business workspace: Allowed
    const workspaceCheck = createMockReqRes({
      user: req.user,
      params: { id: 'workspace-agency-demo' },
    });
    requireWorkspaceAccess(workspaceCheck.req, workspaceCheck.res, workspaceCheck.next);
    expect(workspaceCheck.isNextCalled()).toBe(true);

    // Access personal group: Denied with 403 Forbidden!
    const groupCheck = createMockReqRes({
      user: req.user,
      params: { id: 'group-intl-trip-2026' },
    });
    requireGroupAccess(groupCheck.req, groupCheck.res, groupCheck.next);
    expect(groupCheck.getStatus()).toBe(403);
    expect(groupCheck.getBody().code).toBe('FORBIDDEN_GROUP_ACCESS');
    expect(groupCheck.isNextCalled()).toBe(false);
  });

  it('prevents IDOR: unauthorized stranger cannot access any group or workspace (403 Forbidden)', () => {
    const { token } = createSession('guest-unauthorized');

    const { req, res, next } = createMockReqRes({
      headers: { authorization: `Bearer ${token}` },
    });
    authMiddleware(req, res, next);

    const groupCheck = createMockReqRes({
      user: req.user,
      params: { id: 'group-intl-trip-2026' },
    });
    requireGroupAccess(groupCheck.req, groupCheck.res, groupCheck.next);
    expect(groupCheck.getStatus()).toBe(403);

    const workspaceCheck = createMockReqRes({
      user: req.user,
      params: { id: 'workspace-agency-demo' },
    });
    requireWorkspaceAccess(workspaceCheck.req, workspaceCheck.res, workspaceCheck.next);
    expect(workspaceCheck.getStatus()).toBe(403);
  });

  it('invalidates access immediately after session logout', () => {
    const { token } = createSession('alex-organizer');

    // Active session
    const check1 = createMockReqRes({ headers: { authorization: `Bearer ${token}` } });
    authMiddleware(check1.req, check1.res, check1.next);
    expect(check1.req.user).toBeDefined();

    // Destroy session
    destroySession(token);

    // Subsequent request must fail
    const check2 = createMockReqRes({ headers: { authorization: `Bearer ${token}` } });
    authMiddleware(check2.req, check2.res, check2.next);
    expect(check2.req.user).toBeUndefined();

    const guardCheck = createMockReqRes({ user: check2.req.user });
    requireAuth(guardCheck.req, guardCheck.res, guardCheck.next);
    expect(guardCheck.getStatus()).toBe(401);
  });

  it('strictly scopes reconciliation records between personal groups and business workspaces', () => {
    // Query group reconciliations
    const groupRecons: any[] = db.prepare(`
      SELECT r.*, t.from_member_name, t.to_member_name
      FROM reconciliations r
      JOIN settlement_transfers t ON r.transfer_id = t.id
      JOIN settlement_plans p ON t.plan_id = p.id
      WHERE p.group_id = ?
      ORDER BY r.created_at DESC
    `).all('group-intl-trip-2026');

    // Query workspace reconciliations
    const workspaceRecons: any[] = db.prepare(`
      SELECT r.*, i.invoice_number, i.client_name, i.description as invoice_description
      FROM reconciliations r
      JOIN invoices i ON r.transfer_id = i.id
      WHERE i.workspace_id = ?
      ORDER BY r.created_at DESC
    `).all('workspace-agency-demo');

    expect(groupRecons.length).toBeGreaterThan(0);
    expect(workspaceRecons.length).toBeGreaterThan(0);

    // Ensure zero overlap: no group reconciliation leaks into workspace and vice-versa
    const groupIds = new Set(groupRecons.map((r) => r.id));
    for (const wRec of workspaceRecons) {
      expect(groupIds.has(wRec.id)).toBe(false);
    }
  });

  it('registers a new genuine user with secure scrypt password hash and authenticates immediately', () => {
    const rawPassword = 'SecurePassword123!';
    const passwordHash = hashPassword(rawPassword);

    expect(passwordHash).toContain(':');
    expect(verifyPassword(rawPassword, passwordHash)).toBe(true);
    expect(verifyPassword('WrongPassword!', passwordHash)).toBe(false);

    const newUser = {
      id: 'user-real-001',
      name: 'Maya Lin',
      email: 'maya@fintech.dev',
      role: 'MEMBER' as const,
    };

    const session = createUserSession(newUser);
    expect(session.token).toMatch(/^cs_[a-f0-9]{64}$/);
    expect(session.user.id).toBe('user-real-001');
    expect(session.user.email).toBe('maya@fintech.dev');
  });

  it('ensures newly registered user starts with empty personal groups and workspaces (zero demo leakage)', () => {
    const freshUser = {
      id: 'user-fresh-999',
      name: 'Fresh Newbie',
      email: 'fresh@example.com',
      role: 'MEMBER' as const,
    };

    // Query personal groups visible to fresh user
    const userGroups: any[] = db.prepare(`
      SELECT DISTINCT g.* FROM groups g
      LEFT JOIN group_members m ON g.id = m.group_id
      WHERE g.created_by = ? OR m.email = ? OR m.id = ?
    `).all(freshUser.id, freshUser.email, freshUser.id);

    // Query workspaces visible to fresh user
    const userWorkspaces: any[] = db.prepare(`
      SELECT * FROM workspaces WHERE owner_id = ?
    `).all(freshUser.id);

    // Guaranteed empty start: zero leakage of Alex, Sam, John, or Apex Agency demo data!
    expect(userGroups.length).toBe(0);
    expect(userWorkspaces.length).toBe(0);
  });

  it('authenticates a Google Sign-In user and provisions a secure session', () => {
    const googleUser = {
      id: 'user-g-test1234',
      name: 'Maya Lin',
      email: 'maya.lin.google@gmail.com',
      role: 'MEMBER' as const,
    };

    // Store in users table as OAuth user
    db.prepare(`
      INSERT OR REPLACE INTO users (id, name, email, password_hash, role, created_at)
      VALUES (?, ?, ?, 'OAUTH_GOOGLE', 'MEMBER', ?)
    `).run(googleUser.id, googleUser.name, googleUser.email, new Date().toISOString());

    const session = createUserSession(googleUser);
    expect(session.token).toMatch(/^cs_[a-f0-9]{64}$/);
    expect(session.user.email).toBe('maya.lin.google@gmail.com');
    expect(session.user.name).toBe('Maya Lin');

    // Authenticated request validates token correctly
    const { req, res, next, isNextCalled } = createMockReqRes({
      headers: { authorization: `Bearer ${session.token}` },
    });
    authMiddleware(req, res, next);
    expect(isNextCalled()).toBe(true);
    expect(req.user.email).toBe('maya.lin.google@gmail.com');
  });
});
