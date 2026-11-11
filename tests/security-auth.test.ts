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
  destroySession,
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
});
