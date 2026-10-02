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
}) => {
  if (!monitor || !['down', 'recovery'].includes(eventType)) {
    console.error(
      '❌ [Telegram] Alert requires a monitor and valid event type.',
    );
    return;
  }

  if (!botToken || !chatId) {
    console.warn('⚠️ [Telegram] Bot token or Chat ID missing. Alert skipped.');
    return;
  }

  const timestamp = new Date().toUTCString();
  let message = '';

  if (eventType === 'down') {
    message = `
🚨 <b>[PULSEGRID INCIDENT ALERT]</b> 🚨

<b>Service:</b> ${escapeHtml(monitor.name)}
<b>Type:</b> <code>${escapeHtml(monitor.type.toUpperCase())}</code>
<b>Target:</b> <code>${escapeHtml(monitor.target)}</code>
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
<b>Target:</b> <code>${escapeHtml(monitor.target)}</code>
<b>Status:</b> 🟢 <b>BACK ONLINE (UP)</b>
<b>Latency:</b> ${latency}ms
<b>Time:</b> ${timestamp}

<i>Incident resolved. Service is healthy and responding.</i>
`.trim();
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'HTML',
        }),
        signal: AbortSignal.timeout(5000),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.ok) {
        console.log(
          `📱 [Telegram] ${eventType.toUpperCase()} alert sent for "${monitor.name}"!`,
        );
        return;
      }

      const errorCode = Number(data.error_code || response.status);
      const description = data.description || `HTTP ${response.status}`;
      const retryable =
        response.status === 429 ||
        response.status >= 500 ||
        errorCode === 429 ||
        errorCode >= 500;

      if (!retryable || attempt === MAX_ATTEMPTS) {
        console.error(
          `❌ [Telegram] API error after ${attempt} attempt(s):`,
          description,
        );
        return;
      }

      const retryAfterSeconds = Number(data.parameters?.retry_after);
      const delayMs =
        errorCode === 429 && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);

      if (delayMs > MAX_RETRY_DELAY_MS) {
        console.error(
          '❌ [Telegram] Retry-After exceeds the maximum retry delay:',
          description,
        );
        return;
      }

      console.warn(
        `⚠️ [Telegram] Temporary API error; retrying (${attempt + 1}/${MAX_ATTEMPTS}) in ${delayMs}ms.`,
      );
      await wait(delayMs);
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) {
        console.error(
          `❌ [Telegram] Dispatch failed after ${attempt} attempts:`,
          err.cause?.code || err.message,
        );
        return;
      }

      const delayMs = RETRY_BASE_DELAY_MS * 2 ** (attempt - 1);
      console.warn(
        `⚠️ [Telegram] Temporary dispatch failure; retrying (${attempt + 1}/${MAX_ATTEMPTS}) in ${delayMs}ms:`,
        err.cause?.code || err.message,
      );
      await wait(delayMs);
    }
  }
};
