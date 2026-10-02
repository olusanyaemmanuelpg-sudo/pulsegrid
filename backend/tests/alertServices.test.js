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

  await sendTelegramAlert({ monitor, eventType: 'recovery' });

  assert.equal(attempts, 1);
});
