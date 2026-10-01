import test from 'node:test';
import assert from 'node:assert/strict';

import { validateHeartbeatToken } from '../controller/heartbeats.js';

test('shared heartbeat token is accepted when present and correct', () => {
  assert.equal(validateHeartbeatToken('abc123', 'abc123'), true);
  assert.equal(validateHeartbeatToken('abc123', 'wrong-token'), false);
  assert.equal(validateHeartbeatToken('abc123', ''), false);
  assert.equal(validateHeartbeatToken('', 'abc123'), false);
});
