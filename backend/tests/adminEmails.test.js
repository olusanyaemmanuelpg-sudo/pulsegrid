import assert from 'node:assert/strict';
import test from 'node:test';
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
  process.env.NODE_ENV = 'production';

  try {
    assert.deepEqual(getAdminEmails(), []);
    assert.equal(isAdminEmail('olusanyaemmanuelpg@gmail.com'), false);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
  }
});