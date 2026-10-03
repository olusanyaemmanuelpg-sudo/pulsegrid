import dotenv from 'dotenv';
dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
const MAX_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 10000;
const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (character) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });

/**
 * Dispatches Telegram alerts for DOWN incidents and UP recoveries.
 * Callers dispatch this without blocking monitor processing. Transient
 * failures are retried up to twice, with a 5s timeout per request.
 */
export const sendTelegramAlert = async ({
  monitor,
  eventType,
  error = null,
  latency = 0,
  chatId: destinationChatId = chatId,
}) => {
  if (!monitor || !['down', 'recovery', 'test'].includes(eventType)) {
    throw new Error('Telegram alert requires a monitor and valid event type.');
  }

  if (!botToken || !destinationChatId) {
    throw new Error('Telegram bot token or Chat ID is missing.');
  }

  const timestamp = new Date().toUTCString();
  let message = '';

  if (eventType === 'down') {
    message = `
🚨 <b>[PULSEGRID INCIDENT ALERT]</b> 🚨

<b>Service:</b> ${escapeHtml(monitor.name)}
<b>Type:</b> <code>${escapeHtml(monitor.type.toUpperCase())}</code>
<b>Status:</b> 🔴 <b>CONFIRMED DOWN</b> (Strike 3 reached)
<b>Reason:</b> <i>${escapeHtml(error || 'Service unresponsive')}</i>
<b>Time:</b> ${timestamp}

<i>PulseGrid Engine has flagged this incident. Immediate attention required.</i>
`.trim();
  } else if (eventType === 'recovery') {
    message = `
✅ <b>[PULSEGRID RECOVERY ALERT]</b> ✅

<b>Service:</b> ${escapeHtml(monitor.name)}
<b>Type:</b> <code>${escapeHtml(monitor.type.toUpperCase())}</code>
<b>Status:</b> 🟢 <b>BACK ONLINE (UP)</b>
<b>Latency:</b> ${latency}ms
<b>Time:</b> ${timestamp}

<i>Incident resolved. Service is healthy and responding.</i>
`.trim();
  } else if (eventType === 'test') {
    message = `
🔔 <b>[PULSEGRID TEST NOTIFICATION]</b> 🔔

<b>Service:</b> ${escapeHtml(monitor.name)}
<b>Type:</b> <code>${escapeHtml(monitor.type.toUpperCase())}</code>
<b>Status:</b> ℹ️ <b>TEST</b>
<b>Time:</b> ${timestamp}

<i>PulseGrid test notification delivered to this Telegram channel.</i>
`.trim();
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: destinationChatId,
          text: message,
          parse_mode: 'HTML',
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        throw err;
      }

      const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `⚠️ [Telegram] Temporary dispatch failure; retrying (${attempt + 1}/${MAX_ATTEMPTS}) in ${delayMs}ms:`,
        err.cause?.code || err.message,
      );
      await wait(delayMs);
      continue;
    }

    const data = await response.json().catch(() => ({}));
    if (response.ok && data.ok) {
      console.log(
        `📱 [Telegram] ${eventType.toUpperCase()} alert sent for "${monitor.name}"!`,
      );
      return { success: true, channel: 'telegram' };
    }

    const errorCode = Number(data.error_code || response.status);
    const description = data.description || `HTTP ${response.status}`;
    const retryable =
      response.status === 429 ||
      response.status >= 500 ||
      errorCode === 429 ||
      errorCode >= 500;

    if (!retryable || attempt === MAX_ATTEMPTS) {
      throw new Error(`Telegram API error: ${description}`);
    }

    const retryAfterSeconds = Number(data.parameters?.retry_after);
    const delayMs =
      errorCode === 429 && retryAfterSeconds > 0
        ? retryAfterSeconds * 1000
        : RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);

    if (delayMs > MAX_RETRY_DELAY_MS) {
      throw new Error(`Telegram retry delay exceeds limit: ${description}`);
    }

    console.warn(
      `⚠️ [Telegram] Temporary API error; retrying (${attempt + 1}/${MAX_ATTEMPTS}) in ${delayMs}ms.`,
    );
    await wait(delayMs);
  }
};
