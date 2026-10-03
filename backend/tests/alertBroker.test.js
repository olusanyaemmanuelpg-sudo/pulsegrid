import test from 'node:test';
import assert from 'node:assert/strict';

import { readPool, writePool } from '../config/db.js';
import { redis } from '../config/redis.js';
import {
  publishAlertEvent,
  dispatchDiscord,
  dispatchWebhook,
  dispatchEmail,
  processAlertEvent,
} from '../service/alertBroker.js';

const originalFetch = globalThis.fetch;
const originalRpush = redis.rpush;
const originalReadQuery = readPool.query;
const originalWriteQuery = writePool.query;
const originalGlobalDispatch = process.env.DISPATCH_GLOBAL_ALERTS;

test.after(() => {
  globalThis.fetch = originalFetch;
  redis.rpush = originalRpush;
  readPool.query = originalReadQuery;
  writePool.query = originalWriteQuery;
  if (originalGlobalDispatch === undefined) {
    delete process.env.DISPATCH_GLOBAL_ALERTS;
  } else {
    process.env.DISPATCH_GLOBAL_ALERTS = originalGlobalDispatch;
  }
});

test('publishAlertEvent pushes valid event onto message broker queue', async () => {
  let capturedKey = null;
  let capturedPayload = null;

  redis.rpush = async (key, val) => {
    capturedKey = key;
    capturedPayload = JSON.parse(val);
    return 1;
  };

  await publishAlertEvent({
    eventType: 'down',
    monitor: { id: 101, name: 'Auth Cluster', type: 'http' },
    error: '504 Gateway Timeout',
  });

  assert.equal(capturedKey, 'alert:queue');
  assert.equal(capturedPayload.eventType, 'down');
  assert.equal(capturedPayload.monitor.name, 'Auth Cluster');
  assert.ok(capturedPayload.timestamp);
});

test('dispatchDiscord sends rich embed payload with proper color code', async () => {
  let capturedBody = null;
  globalThis.fetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return new Response(null, { status: 204 });
  };

  const res = await dispatchDiscord(
    'https://discord.com/api/webhooks/mock/123',
    {
      eventType: 'down',
      monitor: { name: 'Main Database', type: 'postgres' },
      error: 'connection pool exhausted',
    },
  );

  assert.equal(res.success, true);
  assert.equal(capturedBody.username, 'PulseGrid Monitoring');
  assert.equal(capturedBody.embeds.length, 1);
  assert.equal(capturedBody.embeds[0].color, 0xef4444); // Red
  assert.equal(
    capturedBody.embeds[0].title,
    '🚨 PulseGrid Incident Alert: Service DOWN',
  );
});

test('dispatchDiscord sends green recovery embed', async () => {
  let capturedBody = null;
  globalThis.fetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return new Response(null, { status: 204 });
  };

  const res = await dispatchDiscord(
    'https://discord.com/api/webhooks/mock/123',
    {
      eventType: 'recovery',
      monitor: { name: 'Main Database', type: 'postgres' },
      latency: 15,
    },
  );

  assert.equal(res.success, true);
  assert.equal(capturedBody.embeds[0].color, 0x10b981); // Green
});

test('dispatchWebhook sends JSON payload with custom signature header', async () => {
  let capturedHeaders = null;
  let capturedBody = null;
  globalThis.fetch = async (url, options) => {
    capturedHeaders = options.headers;
    capturedBody = JSON.parse(options.body);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  };

  const res = await dispatchWebhook(
    'https://pagerduty.example.com/webhook',
    {
      eventType: 'down',
      monitor: { id: 42, name: 'Payments API', type: 'http' },
      error: 'HTTP 500',
    },
    'secret-token-sig',
  );

  assert.equal(res.success, true);
  assert.equal(capturedHeaders['X-PulseGrid-Signature'], 'secret-token-sig');
  assert.equal(capturedBody.event, 'monitor.down');
  assert.equal(capturedBody.monitor.id, 42);
});

test('dispatchEmail returns success with recipient', async () => {
  const res = await dispatchEmail('ops-team@pulsegrid.io', {
    eventType: 'down',
    monitor: { name: 'Redis Cache' },
  });

  assert.equal(res.success, true);
  assert.equal(res.recipient, 'ops-team@pulsegrid.io');
});

test('down and recovery events fan out only to all configured channels', async () => {
  const configuredChannels = [
    {
      id: 1,
      type: 'telegram',
      name: 'Chosen Telegram',
      config: { chat_id: '-1001234567890' },
      is_enabled: true,
    },
    {
      id: 2,
      type: 'email',
      name: 'Chosen Email',
      config: { email: 'alerts@example.test' },
      is_enabled: true,
    },
  ];
  const deliveredChatIds = [];

  readPool.query = async () => ({ rows: configuredChannels });
  writePool.query = async () => ({ rows: configuredChannels });
  process.env.DISPATCH_GLOBAL_ALERTS = 'true';
  process.env.TELEGRAM_CHAT_ID = 'global-env-chat';
  globalThis.fetch = async (_url, options) => {
    deliveredChatIds.push(JSON.parse(options.body).chat_id);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  for (const eventType of ['down', 'recovery']) {
    const results = await processAlertEvent({
      eventType,
      monitor: {
        id: 101,
        user_id: 9,
        name: 'Payments API',
        type: 'http',
      },
      latency: 42,
    });

    assert.equal(results.length, configuredChannels.length);
    assert.ok(results.every((result) => result.status === 'fulfilled'));
  }

  assert.deepEqual(deliveredChatIds, ['-1001234567890', '-1001234567890']);
});

test('events without configured channels do not use the global Telegram chat', async () => {
  let telegramRequestCount = 0;
  readPool.query = async () => ({ rows: [] });
  writePool.query = async () => ({ rows: [] });
  process.env.DISPATCH_GLOBAL_ALERTS = 'true';
  globalThis.fetch = async () => {
    telegramRequestCount += 1;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  await processAlertEvent({
    eventType: 'down',
    monitor: { id: 101, user_id: 9, name: 'Payments API', type: 'http' },
  });

  assert.equal(telegramRequestCount, 0);
});
