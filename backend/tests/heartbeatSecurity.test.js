import test from 'node:test';
import assert from 'node:assert/strict';

import { redis } from '../config/redis.js';
import { pool } from '../config/db.js';
import { validateHeartbeatToken } from '../controller/heartbeats.js';
import { getActiveWorkers } from '../service/workerRegistry.js';

test.after(async () => {
  await redis.quit();
  await pool.end();
});

test('shared heartbeat token is accepted when present and correct', () => {
  assert.equal(validateHeartbeatToken('abc123', 'abc123'), true);
  assert.equal(validateHeartbeatToken('abc123', 'wrong-token'), false);
  assert.equal(validateHeartbeatToken('abc123', ''), false);
  assert.equal(validateHeartbeatToken('', 'abc123'), false);
});

test('active workers are not self-elected when the cluster registry is empty', async () => {
  const originalSmembers = redis.smembers;
  const originalPipeline = redis.pipeline;

  try {
    redis.smembers = async () => [];
    redis.pipeline = () => ({
      exists() {},
      exec: async () => [],
    });

    const workers = await getActiveWorkers();
    assert.deepEqual(workers, []);
  } finally {
    redis.smembers = originalSmembers;
    redis.pipeline = originalPipeline;
  }
});
