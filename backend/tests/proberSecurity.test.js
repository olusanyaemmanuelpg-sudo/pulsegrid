import test from 'node:test';
import assert from 'node:assert/strict';
import {
  probePostgres,
  probeRedis,
  proberHttp,
  sanitizeProbeError,
} from '../service/prober.js';

test('probers refuse private destinations before making connections', async () => {
  const results = await Promise.all([
    proberHttp('http://127.0.0.1:3000/api/health'),
    probePostgres('postgresql://probe:secret@10.0.0.4:5432/app'),
    probeRedis('rediss://probe:secret@169.254.169.254:6379'),
  ]);

  for (const result of results) {
    assert.equal(result.status, 'down');
    assert.match(result.error, /Private and local monitor destinations/);
    assert.doesNotMatch(result.error, /secret|probe|127\.0\.0\.1|10\.0\.0\.4/);
  }
});

test('probe errors redact raw target URLs and credentials', () => {
  const target = 'postgresql://probe:secret@db.example.com/app';
  const error = sanitizeProbeError(
    new Error(`failed connecting to ${target}`),
    target,
  );

  assert.doesNotMatch(error, /probe|secret|db\.example/);
});
