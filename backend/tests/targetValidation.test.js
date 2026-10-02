import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createPinnedLookup,
  resolvePublicMonitorTarget,
} from '../security/targetValidation.js';

test('rejects loopback, private, link-local, and non-HTTP schemes', async () => {
  for (const target of [
    'http://127.0.0.1/health',
    'http://[::1]/health',
    'http://localhost/health',
    'https://example.com/health',
  ]) {
    await assert.rejects(
      resolvePublicMonitorTarget('http', target, async () => [
        { address: '10.0.0.5', family: 4 },
      ]),
      /Private and local|scheme/,
    );
  }

  await assert.rejects(
    resolvePublicMonitorTarget('redis', 'redis://cache.example.com'),
    /scheme is not allowed/,
  );
});

test('rejects any hostname resolving to a non-public address', async () => {
  await assert.rejects(
    resolvePublicMonitorTarget(
      'postgres',
      'postgresql://probe:secret@db.example.com/app',
      async () => [
        { address: '8.8.8.8', family: 4 },
        { address: '169.254.169.254', family: 4 },
      ],
    ),
    /Private and local/,
  );
});

test('returns public DNS answers for pinned connections', async () => {
  const result = await resolvePublicMonitorTarget(
    'http',
    'https://status.example.com/health',
    async () => [{ address: '8.8.8.8', family: 4 }],
  );
  const lookup = createPinnedLookup(result.addresses);

  assert.equal(result.hostname, 'status.example.com');
  assert.deepEqual(result.addresses, [{ address: '8.8.8.8', family: 4 }]);
  assert.deepEqual(
    await new Promise((resolve, reject) =>
      lookup('status.example.com', { all: true }, (error, addresses) =>
        error ? reject(error) : resolve(addresses),
      ),
    ),
    [{ address: '8.8.8.8', family: 4 }],
  );
});
