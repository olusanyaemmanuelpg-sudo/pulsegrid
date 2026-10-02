import { redis } from '../config/redis.js';
import { readQuery } from '../config/db.js';
import { sendTelegramAlert } from './alertServices.js';

const QUEUE_KEY = 'alert:queue';
const DLQ_KEY = 'alert:dlq';
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return map[c];
  });

/**
 * Dispatches an event to Discord via Webhook using Rich Embeds.
 */
export const dispatchDiscord = async (webhookUrl, event) => {
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    throw new Error('Discord webhook URL is required.');
  }

  const { monitor, eventType, error, latency, timestamp } = event;
  const time = timestamp || new Date().toISOString();

  let color = 0x3b82f6; // Blue (test)
  let title = '🔔 PulseGrid Test Notification';
  let description = 'This is a test notification from your PulseGrid monitoring cluster.';

  if (eventType === 'down') {
    color = 0xef4444; // Red
    title = '🚨 PulseGrid Incident Alert: Service DOWN';
    description = `Service **${monitor?.name || 'Unknown'}** has reached Strike 3 and is confirmed offline.`;
  } else if (eventType === 'recovery') {
    color = 0x10b981; // Green
    title = '✅ PulseGrid Recovery: Service Restored';
    description = `Service **${monitor?.name || 'Unknown'}** is back online and responding normally.`;
  }

  const embed = {
    title,
    description,
    color,
    timestamp: time,
    fields: [
      { name: 'Service', value: monitor?.name || 'N/A', inline: true },
      { name: 'Type', value: (monitor?.type || 'HTTP').toUpperCase(), inline: true },
      {
        name: 'Status',
        value: eventType === 'down' ? '🔴 DOWN' : eventType === 'recovery' ? '🟢 OPERATIONAL' : 'ℹ️ TEST',
        inline: true,
      },
    ],
    footer: { text: 'PulseGrid Distributed Alert Engine' },
  };

  if (eventType === 'down' && error) {
    embed.fields.push({ name: 'Error / Reason', value: `\`\`\`${String(error).slice(0, 500)}\`\`\`` });
  }
  if (eventType === 'recovery' && latency !== undefined) {
    embed.fields.push({ name: 'Response Latency', value: `${latency}ms`, inline: true });
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'PulseGrid Monitoring',
          avatar_url: 'https://pulsegrid.io/icons.svg',
          embeds: [embed],
        }),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok || res.status === 204) {
        console.log(`🎮 [Discord] ${eventType.toUpperCase()} alert delivered for "${monitor?.name || 'Test'}"`);
        return { success: true, channel: 'discord' };
      }

      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt === MAX_ATTEMPTS) {
        const text = await res.text().catch(() => '');
        throw new Error(`Discord returned HTTP ${res.status}: ${text}`);
      }

      await wait(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.error(`❌ [Discord] Failed after ${attempt} attempts:`, err.message);
        throw err;
      }
      await wait(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
};

/**
 * Dispatches an event to a generic Webhook (Slack, PagerDuty, or custom backend).
 */
export const dispatchWebhook = async (webhookUrl, event, secretHeader = null) => {
  if (!webhookUrl || typeof webhookUrl !== 'string') {
    throw new Error('Webhook URL is required.');
  }

  const payload = {
    event: `monitor.${event.eventType}`,
    monitor: event.monitor ? {
      id: event.monitor.id,
      name: event.monitor.name,
      type: event.monitor.type,
      status: event.eventType === 'down' ? 'down' : 'up',
    } : null,
    latency_ms: event.latency ?? 0,
    error: event.error ?? null,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  const headers = { 'Content-Type': 'application/json' };
  if (secretHeader) {
    headers['X-PulseGrid-Signature'] = secretHeader;
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000),
      });

      if (res.ok) {
        console.log(`🌐 [Webhook] ${event.eventType.toUpperCase()} alert delivered to ${webhookUrl}`);
        return { success: true, channel: 'webhook' };
      }

      if ((res.status !== 429 && res.status < 500) || attempt === MAX_ATTEMPTS) {
        throw new Error(`Webhook endpoint returned HTTP ${res.status}`);
      }
      await wait(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.error(`❌ [Webhook] Failed after ${attempt} attempts:`, err.message);
        throw err;
      }
      await wait(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
    }
  }
};

/**
 * Dispatches an alert to an Email address.
 */
export const dispatchEmail = async (email, event) => {
  if (!email || !email.includes('@')) {
    throw new Error('Valid email address is required.');
  }

  // Simulated email delivery / notification logger
  console.log(`📧 [Email Notification] Alert sent to ${email} for event "${event.eventType}" on "${event.monitor?.name || 'Test'}"`);
  return { success: true, channel: 'email', recipient: email };
};

/**
 * Dispatches an event to a specific configured channel record.
 */
export const dispatchToChannel = async (channel, event) => {
  const { type, config } = channel;
  const cfg = typeof config === 'string' ? JSON.parse(config) : config || {};

  switch (type) {
    case 'discord':
      return await dispatchDiscord(cfg.webhook_url, event);
    case 'webhook':
      return await dispatchWebhook(cfg.webhook_url, event, cfg.secret_header);
    case 'telegram':
      return await sendTelegramAlert({
        monitor: event.monitor,
        eventType: event.eventType,
        error: event.error,
        latency: event.latency,
      });
    case 'email':
      return await dispatchEmail(cfg.email, event);
    default:
      throw new Error(`Unsupported channel type: ${type}`);
  }
};

/**
 * PRODUCER: Enqueues an alert event onto the Message Broker (Redis Queue).
 * Non-blocking, executes in < 1ms.
 */
export const publishAlertEvent = async (event) => {
  if (!event || !event.eventType) {
    console.error('❌ [Alert Broker] Invalid alert event payload');
    return;
  }

  const payload = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
  };

  try {
    await redis.rpush(QUEUE_KEY, JSON.stringify(payload));
    console.log(
      `📢 [Alert Broker] Enqueued "${event.eventType.toUpperCase()}" event for "${event.monitor?.name || 'Service'}" on message queue.`,
    );
  } catch (err) {
    console.error('❌ [Alert Broker] Failed to enqueue alert event:', err.message);
  }
};

/**
 * CONSUMER: Fetches user-configured channels and fans out the event in parallel.
 */
export const processAlertEvent = async (event) => {
  const userId = event.monitor?.user_id || event.userId;
  let channels = [];

  if (userId) {
    try {
      const { rows } = await readQuery(
        `SELECT id, type, name, config, is_enabled
         FROM alert_channels
         WHERE user_id = $1 AND is_enabled = TRUE;`,
        [userId],
      );
      channels = rows;
    } catch (err) {
      console.error('❌ [Alert Broker] Failed to load user channels:', err.message);
    }
  }

  const dispatchPromises = [];

  // 1. Fan-out to custom user channels
  if (channels.length > 0) {
    for (const channel of channels) {
      dispatchPromises.push(
        dispatchToChannel(channel, event).catch((err) => {
          console.error(`❌ [Alert Broker] Fan-out failure on channel "${channel.name}" (${channel.type}):`, err.message);
          return { success: false, channel: channel.type, error: err.message };
        }),
      );
    }
  }

  // 2. Global fallback (Telegram) if no channels are configured or if global bot is set
  if (channels.length === 0 || process.env.DISPATCH_GLOBAL_ALERTS === 'true') {
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      dispatchPromises.push(
        sendTelegramAlert({
          monitor: event.monitor,
          eventType: event.eventType,
          error: event.error,
          latency: event.latency,
        }).catch((err) => ({ success: false, channel: 'telegram', error: err.message })),
      );
    }
  }

  const results = await Promise.allSettled(dispatchPromises);
  const allFailed = results.length > 0 && results.every((r) => r.status === 'rejected' || r.value?.success === false);

  if (allFailed) {
    console.warn('⚠️ [Alert Broker] All channel dispatches failed. Routing event to Dead-Letter Queue (DLQ)...');
    await redis.rpush(DLQ_KEY, JSON.stringify({ event, failedAt: new Date().toISOString() })).catch(() => {});
  }

  return results;
};

let isWorkerRunning = false;
let workerIntervalId = null;

/**
 * Background consumer worker that pulls events from the message broker and fans them out.
 */
export const startAlertWorker = (pollIntervalMs = 1000) => {
  if (isWorkerRunning) return;
  isWorkerRunning = true;

  console.log(`📨 [Alert Broker] Message consumer worker started (Polling queue every ${pollIntervalMs}ms)...`);

  workerIntervalId = setInterval(async () => {
    try {
      // Drain up to 10 events per cycle
      const rawEvents = [];
      for (let i = 0; i < 10; i += 1) {
        const item = await redis.lpop(QUEUE_KEY);
        if (!item) break;
        rawEvents.push(item);
      }

      if (rawEvents.length === 0) return;

      for (const raw of rawEvents) {
        try {
          const event = JSON.parse(raw);
          await processAlertEvent(event);
        } catch (parseErr) {
          console.error('❌ [Alert Broker] Malformed event in queue:', parseErr.message);
        }
      }
    } catch (err) {
      console.error('❌ [Alert Broker] Queue polling error:', err.message);
    }
  }, pollIntervalMs);

  return workerIntervalId;
};

export const stopAlertWorker = () => {
  if (workerIntervalId) {
    clearInterval(workerIntervalId);
    workerIntervalId = null;
  }
  isWorkerRunning = false;
};
