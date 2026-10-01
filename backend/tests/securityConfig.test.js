import test from 'node:test';
import assert from 'node:assert/strict';

import { getAllowedOrigins, isOriginAllowed } from '../security/cors.js';

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
