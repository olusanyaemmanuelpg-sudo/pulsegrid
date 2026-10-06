import test from 'node:test';
import assert from 'node:assert/strict';

process.env.MONITOR_TARGET_ENCRYPTION_KEY = 'a'.repeat(64);

const {
  decryptMonitorTarget,
  encryptMonitorTarget,
  fingerprintMonitorTarget,
  getMonitorTargetPreview,
} = await import('../security/monitorTargetSecurity.js');

test('monitor targets encrypt with authenticated encryption and round-trip', () => {
  const target =
    'postgresql://probe:secret@example.com:5432/app?sslmode=require';
  const encrypted = encryptMonitorTarget(target);

  assert.notEqual(encrypted, target);
  assert.equal(decryptMonitorTarget(encrypted), target);
  assert.notEqual(encryptMonitorTarget(target), encrypted);
});

test('tampered monitor target ciphertext is rejected', () => {
  const encrypted = encryptMonitorTarget('redis://probe:secret@example.com');
  const parts = encrypted.split(':');
  parts[3] = `${parts[3][0] === 'a' ? 'b' : 'a'}${parts[3].slice(1)}`;
  const tampered = parts.join(':');

  assert.throws(() => decryptMonitorTarget(tampered));
});

test('target fingerprints are stable and previews omit credentials and paths', () => {
  const target = 'redis://probe:secret@example.com:6380/0?token=hidden';
  const preview = getMonitorTargetPreview(target, 'redis');

  assert.equal(
    fingerprintMonitorTarget(target),
    fingerprintMonitorTarget(target),
  );
  assert.equal(preview, 'redis://example.com:6380/[redacted]');
  assert.doesNotMatch(preview, /probe|secret|token|hidden/);
});

test('target encryption refuses to run without a valid external key', () => {
  const originalKey = process.env.MONITOR_TARGET_ENCRYPTION_KEY;
  delete process.env.MONITOR_TARGET_ENCRYPTION_KEY;

  try {
    assert.throws(
      () => encryptMonitorTarget('redis://cache.example.com'),
      /MONITOR_TARGET_ENCRYPTION_KEY/,
    );
  } finally {
    process.env.MONITOR_TARGET_ENCRYPTION_KEY = originalKey;
  }
});
