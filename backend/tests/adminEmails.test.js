import assert from 'node:assert/strict';
import test from 'node:test';
import requireAuth from '../middleware/requireAuth.js';
import { validateRuntimeConfig } from '../config/db.js';
import { getAdminEmails, isAdminEmail } from '../security/adminEmails.js';

test('admin email allowlist is normalized', () => {
  assert.deepEqual(getAdminEmails(' Admin@Example.com, other@example.com '), [
    'admin@example.com',
    'other@example.com',
  ]);
  assert.equal(isAdminEmail('ADMIN@example.com', 'admin@example.com'), true);
  assert.equal(isAdminEmail('user@example.com', 'admin@example.com'), false);
});

test('admin email allowlist defaults to the configured account in local dev', () => {
  assert.deepEqual(getAdminEmails(''), ['olusanyaemmanuelpg@gmail.com']);
  assert.equal(isAdminEmail('OlusanyaEmmanuelPG@gmail.com'), true);
});

test('production mode does not silently grant a hardcoded admin fallback', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousAdminEmails = process.env.ADMIN_EMAILS;
  process.env.NODE_ENV = 'production';
  delete process.env.ADMIN_EMAILS;

  try {
    assert.deepEqual(getAdminEmails(), []);
    assert.equal(isAdminEmail('olusanyaemmanuelpg@gmail.com'), false);
  } finally {
    if (previousAdminEmails === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = previousAdminEmails;
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test('missing JWT secret is rejected before auth can proceed', () => {
  const previousJwtSecret = process.env.JWT_SECRET;
  const previousNodeEnv = process.env.NODE_ENV;
  delete process.env.JWT_SECRET;
  process.env.NODE_ENV = 'production';

  const req = {
    headers: { authorization: 'Bearer abcdefghijklmnopqrstuvwxyz123456' },
  };
  const res = {
    statusCode: null,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.payload = data;
      return this;
    },
  };

  const next = () => {
    throw new Error('next should not run');
  };

  try {
    const result = requireAuth(req, res, next);
    assert.equal(result, undefined);
    assert.equal(res.statusCode, 500);
    assert.match(res.payload.message, /authentication is not configured/i);
  } finally {
    if (previousJwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousJwtSecret;
    process.env.NODE_ENV = previousNodeEnv;
  }
});

test('production startup validation fails when required runtime env is missing', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const previousRedisUrl = process.env.REDIS_URL;
  const previousMonitorKey = process.env.MONITOR_TARGET_ENCRYPTION_KEY;

  process.env.NODE_ENV = 'production';
  delete process.env.DATABASE_URL;
  delete process.env.REDIS_URL;
  delete process.env.MONITOR_TARGET_ENCRYPTION_KEY;

  try {
    assert.throws(
      () => validateRuntimeConfig(),
      /missing required environment variables/i,
    );
  } finally {
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousRedisUrl;
    if (previousMonitorKey === undefined)
      delete process.env.MONITOR_TARGET_ENCRYPTION_KEY;
    else process.env.MONITOR_TARGET_ENCRYPTION_KEY = previousMonitorKey;
    process.env.NODE_ENV = previousNodeEnv;
  }
});
