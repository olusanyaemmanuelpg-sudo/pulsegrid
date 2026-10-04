import test from 'node:test';
import assert from 'node:assert/strict';
import { requireAdmin } from '../middleware/requireAdmin.js';
import { updateUserRole } from '../controller/adminController.js';

test('requireAdmin rejects unauthenticated requests with 401', async () => {
  let status = null;
  let jsonBody = null;

  const req = {};
  const res = {
    status(code) {
      status = code;
      return {
        json(body) {
          jsonBody = body;
        },
      };
    },
  };

  let nextCalled = false;
  await requireAdmin(req, res, () => {
    nextCalled = true;
  });

  assert.equal(status, 401);
  assert.equal(nextCalled, false);
  assert.match(jsonBody.message, /Authentication required/i);
});

test('requireAdmin rejects standard developer users with 403', async () => {
  let status = null;
  let jsonBody = null;

  const req = {
    user: { id: 9999, email: 'dev@pulsegrid.io' },
  };
  const res = {
    status(code) {
      status = code;
      return {
        json(body) {
          jsonBody = body;
        },
      };
    },
  };

  const mockQueryFn = async () => ({
    rows: [{ id: 9999, email: 'dev@pulsegrid.io', role: 'developer' }],
  });

  let nextCalled = false;
  await requireAdmin(req, res, () => {
    nextCalled = true;
  }, mockQueryFn);

  assert.equal(status, 403);
  assert.equal(nextCalled, false);
  assert.match(jsonBody.message, /Administrator privileges required/i);
});

test('requireAdmin grants access to administrator users and sets req.user.role', async () => {
  const req = {
    user: { id: 1, email: 'admin@pulsegrid.io' },
  };
  const res = {};

  const mockQueryFn = async () => ({
    rows: [{ id: 1, email: 'admin@pulsegrid.io', role: 'admin' }],
  });

  let nextCalled = false;
  await requireAdmin(req, res, () => {
    nextCalled = true;
  }, mockQueryFn);

  assert.equal(nextCalled, true);
  assert.equal(req.user.role, 'admin');
});

test('updateUserRole rejects invalid roles with 400', async () => {
  let status = null;
  let jsonBody = null;

  const req = {
    params: { id: '5' },
    body: { role: 'super-hacker' },
    user: { id: 1 },
  };
  const res = {
    status(code) {
      status = code;
      return {
        json(body) {
          jsonBody = body;
        },
      };
    },
  };

  await updateUserRole(req, res);

  assert.equal(status, 400);
  assert.match(jsonBody.message, /Invalid user ID or role/i);
});

test('updateUserRole blocks admin self-demotion with 400', async () => {
  let status = null;
  let jsonBody = null;

  const req = {
    params: { id: '1' },
    body: { role: 'developer' },
    user: { id: 1 },
  };
  const res = {
    status(code) {
      status = code;
      return {
        json(body) {
          jsonBody = body;
        },
      };
    },
  };

  await updateUserRole(req, res);

  assert.equal(status, 400);
  assert.match(jsonBody.message, /cannot revoke your own administrator privileges/i);
});

test('adminTestMonitor rejects invalid monitor ID with 400', async () => {
  let status = null;
  let jsonBody = null;

  const req = { params: { id: 'abc' } };
  const res = {
    status(code) {
      status = code;
      return {
        json(body) {
          jsonBody = body;
        },
      };
    },
  };

  const { adminTestMonitor } = await import('../controller/adminController.js');
  await adminTestMonitor(req, res);

  assert.equal(status, 400);
  assert.match(jsonBody.message, /Invalid monitor ID/i);
});

test('adminDeleteMonitor rejects invalid monitor ID with 400', async () => {
  let status = null;
  let jsonBody = null;

  const req = { params: { id: 'invalid' } };
  const res = {
    status(code) {
      status = code;
      return {
        json(body) {
          jsonBody = body;
        },
      };
    },
  };

  const { adminDeleteMonitor } = await import('../controller/adminController.js');
  await adminDeleteMonitor(req, res);

  assert.equal(status, 400);
  assert.match(jsonBody.message, /Invalid monitor ID/i);
});

