import { readQuery, writeQuery } from '../config/db.js';
import { dispatchToChannel, publishAlertEvent } from '../service/alertBroker.js';

const VALID_TYPES = new Set(['discord', 'webhook', 'telegram', 'email']);

export const getChannels = async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await readQuery(
      `SELECT id, type, name, config, is_enabled, created_at
       FROM alert_channels
       WHERE user_id = $1
       ORDER BY created_at DESC;`,
      [userId],
    );

    return res.status(200).json({ channels: rows });
  } catch (err) {
    console.error('Failed to fetch alert channels:', err.message);
    return res.status(500).json({ message: 'Unable to fetch alert channels.' });
  }
};

export const createChannel = async (req, res) => {
  const userId = req.user.id;
  const { type, name, config } = req.body ?? {};

  if (!type || !VALID_TYPES.has(type)) {
    return res.status(400).json({
      message: `Invalid channel type. Allowed: ${[...VALID_TYPES].join(', ')}`,
    });
  }

  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) {
    return res.status(400).json({ message: 'A valid channel name is required (max 100 chars).' });
  }

  const cleanConfig = typeof config === 'object' && config !== null ? config : {};

  // Channel-specific validation
  if (type === 'discord') {
    if (!cleanConfig.webhook_url || !cleanConfig.webhook_url.startsWith('https://')) {
      return res.status(400).json({ message: 'A valid HTTPS Discord Webhook URL is required.' });
    }
  } else if (type === 'webhook') {
    if (!cleanConfig.webhook_url || (!cleanConfig.webhook_url.startsWith('http://') && !cleanConfig.webhook_url.startsWith('https://'))) {
      return res.status(400).json({ message: 'A valid HTTP/HTTPS Webhook URL is required.' });
    }
  } else if (type === 'email') {
    if (!cleanConfig.email || !cleanConfig.email.includes('@')) {
      return res.status(400).json({ message: 'A valid email address is required.' });
    }
  } else if (type === 'telegram') {
    if (!cleanConfig.chat_id && !process.env.TELEGRAM_CHAT_ID) {
      return res.status(400).json({ message: 'A Telegram Chat ID is required.' });
    }
  }

  try {
    const { rows } = await writeQuery(
      `INSERT INTO alert_channels (user_id, type, name, config, is_enabled)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, type, name, config, is_enabled, created_at;`,
      [userId, type, name.trim(), JSON.stringify(cleanConfig)],
    );

    return res.status(201).json({ channel: rows[0] });
  } catch (err) {
    console.error('Failed to create alert channel:', err.message);
    return res.status(500).json({ message: 'Unable to create alert channel.' });
  }
};

export const updateChannel = async (req, res) => {
  const userId = req.user.id;
  const channelId = Number(req.params.id);

  if (!Number.isSafeInteger(channelId) || channelId <= 0) {
    return res.status(400).json({ message: 'Invalid channel ID.' });
  }

  const { name, is_enabled, config } = req.body ?? {};

  try {
    const { rows: existing } = await readQuery(
      `SELECT * FROM alert_channels WHERE id = $1 AND user_id = $2;`,
      [channelId, userId],
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'Alert channel not found.' });
    }

    const current = existing[0];
    const newName = typeof name === 'string' && name.trim() ? name.trim() : current.name;
    const newEnabled = typeof is_enabled === 'boolean' ? is_enabled : current.is_enabled;
    const newConfig = typeof config === 'object' && config !== null ? JSON.stringify(config) : current.config;

    const { rows: updated } = await writeQuery(
      `UPDATE alert_channels
       SET name = $1, is_enabled = $2, config = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, type, name, config, is_enabled, created_at;`,
      [newName, newEnabled, newConfig, channelId, userId],
    );

    return res.status(200).json({ channel: updated[0] });
  } catch (err) {
    console.error('Failed to update alert channel:', err.message);
    return res.status(500).json({ message: 'Unable to update alert channel.' });
  }
};

export const deleteChannel = async (req, res) => {
  const userId = req.user.id;
  const channelId = Number(req.params.id);

  if (!Number.isSafeInteger(channelId) || channelId <= 0) {
    return res.status(400).json({ message: 'Invalid channel ID.' });
  }

  try {
    const { rows } = await writeQuery(
      `DELETE FROM alert_channels WHERE id = $1 AND user_id = $2 RETURNING id;`,
      [channelId, userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Alert channel not found.' });
    }

    return res.status(200).json({ message: 'Alert channel deleted successfully.' });
  } catch (err) {
    console.error('Failed to delete alert channel:', err.message);
    return res.status(500).json({ message: 'Unable to delete alert channel.' });
  }
};

export const testChannel = async (req, res) => {
  const userId = req.user.id;
  const channelId = Number(req.params.id);

  if (!Number.isSafeInteger(channelId) || channelId <= 0) {
    return res.status(400).json({ message: 'Invalid channel ID.' });
  }

  try {
    const { rows } = await readQuery(
      `SELECT * FROM alert_channels WHERE id = $1 AND user_id = $2;`,
      [channelId, userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Alert channel not found.' });
    }

    const channel = rows[0];
    const testEvent = {
      eventType: 'test',
      monitor: {
        id: 0,
        name: 'PulseGrid Test Monitor',
        type: 'http',
        user_id: userId,
      },
      latency: 42,
      timestamp: new Date().toISOString(),
    };

    const result = await dispatchToChannel(channel, testEvent);

    return res.status(200).json({
      success: true,
      message: `Test alert dispatched to ${channel.name} (${channel.type})!`,
      result,
    });
  } catch (err) {
    console.error('Failed to test alert channel:', err.message);
    return res.status(500).json({
      message: `Failed to deliver test alert: ${err.message}`,
    });
  }
};
