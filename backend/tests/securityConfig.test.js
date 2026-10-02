import test from 'node:test';
import assert from 'node:assert/strict';

import { getAllowedOrigins, isOriginAllowed } from '../security/cors.js';
import { getReplicaConfig } from '../config/db.js';

test('allowlist accepts configured origins and blocks unknown ones', () => {
  process.env.CORS_ORIGIN = 'https://app.example.com,https://admin.example.com';

  assert.deepEqual(getAllowedOrigins(), [
    'https://app.example.com',
    'https://admin.example.com',
  ]);
  assert.equal(isOriginAllowed('https://app.example.com'), true);
  assert.equal(isOriginAllowed('https://evil.example.com'), false);
  assert.equal(isOriginAllowed(undefined), true);
});

test('replica config stays primary-only unless a dedicated read URL is configured', () => {
  const originalReadUrl = process.env.DATABASE_READ_URL;
  const originalDbUrl = process.env.DATABASE_URL;

  try {
    process.env.DATABASE_URL = 'postgresql://primary.example.com/db';
    delete process.env.DATABASE_READ_URL;
    assert.deepEqual(getReplicaConfig(), {
      enabled: false,
      readConnectionString: 'postgresql://primary.example.com/db',
      mode: 'primary-only',
    });

    process.env.DATABASE_READ_URL = 'postgresql://replica.example.com/db';
    assert.deepEqual(getReplicaConfig(), {
      enabled: true,
      readConnectionString: 'postgresql://replica.example.com/db',
      mode: 'replica',
    });
  } finally {
    if (originalReadUrl === undefined) {
      delete process.env.DATABASE_READ_URL;
    } else {
      process.env.DATABASE_READ_URL = originalReadUrl;
    }

    if (originalDbUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDbUrl;
    }
  }
});
