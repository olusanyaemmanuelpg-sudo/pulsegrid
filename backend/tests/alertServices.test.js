import test from 'node:test';
import assert from 'node:assert/strict';

process.env.TELEGRAM_BOT_TOKEN = 'test-token';
process.env.TELEGRAM_CHAT_ID = 'test-chat';

const { sendTelegramAlert } = await import('../service/alertServices.js');
const originalFetch = globalThis.fetch;

test.after(() => {
  globalThis.fetch = originalFetch;
});

const monitor = {
  name: 'test monitor',
  type: 'http',
  target: 'https://example.test',
};

test('Telegram alert retries transient network and server failures', async () => {
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('network unavailable');
    if (attempts === 2) {
      return new Response(JSON.stringify({ ok: false }), { status: 503 });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  await sendTelegramAlert({ monitor, eventType: 'down' });

  assert.equal(attempts, 3);
});

test('Telegram alert does not retry permanent API errors', async () => {
  let attempts = 0;
  globalThis.fetch = async () => {
    attempts += 1;
    return new Response(
      JSON.stringify({ ok: false, description: 'Unauthorized' }),
      { status: 401 },
    );
  };

  await assert.rejects(
    sendTelegramAlert({ monitor, eventType: 'recovery' }),
    /Telegram API error: Unauthorized/,
  );

  assert.equal(attempts, 1);
});

test('Telegram alert payload does not include connection targets', async () => {
  let sentMessage = '';
  globalThis.fetch = async (_url, options) => {
    sentMessage = JSON.parse(options.body).text;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  await sendTelegramAlert({
    monitor: {
      ...monitor,
      type: 'postgres',
      target: 'postgresql://probe:private-password@db.example.com/app',
    },
    eventType: 'down',
  });

  assert.doesNotMatch(
    sentMessage,
    /postgresql|probe|private-password|db\.example/,
  );
});

test('Telegram test alert targets the configured channel', async () => {
  let sentPayload = null;
  globalThis.fetch = async (_url, options) => {
    sentPayload = JSON.parse(options.body);
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  };

  const result = await sendTelegramAlert({
    monitor,
    eventType: 'test',
    chatId: '-1001234567890',
  });

  assert.deepEqual(result, { success: true, channel: 'telegram' });
  assert.equal(sentPayload.chat_id, '-1001234567890');
  assert.match(sentPayload.text, /TEST NOTIFICATION/);
});
