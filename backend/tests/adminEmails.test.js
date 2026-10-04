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

test('admin email allowlist defaults to the configured account', () => {
  assert.deepEqual(getAdminEmails(''), ['olusanyaemmanuelpg@gmail.com']);
  assert.equal(isAdminEmail('OlusanyaEmmanuelPG@gmail.com'), true);
});