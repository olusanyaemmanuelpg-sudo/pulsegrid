import dotenv from 'dotenv';
dotenv.config();

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;
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
 * Non-blocking with 5s timeout.
 */
export const sendTelegramAlert = async ({
  monitor,
  eventType,
  error = null,
  latency = 0,
}) => {
  if (!monitor || !['down', 'recovery'].includes(eventType)) {
    console.error('❌ [Telegram] Alert requires a monitor and valid event type.');
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

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
      signal: AbortSignal.timeout(5000), // Non-blocking 5s timeout
    });

    const data = await response.json();
    if (!data.ok) {
      console.error(
        '❌ [Telegram] API responded with error:',
        data.description,
      );
    } else {
      console.log(
        `📱 [Telegram] ${eventType.toUpperCase()} alert sent for "${monitor.name}"!`,
      );
    }
  } catch (err) {
    console.error('❌ [Telegram] Failed to dispatch alert:', err.message);
  }
};
