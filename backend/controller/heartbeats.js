import { query } from '../config/db.js';
import { redis } from '../config/redis.js';
import { sendTelegramAlert } from '../service/alertServices.js';

export const validateHeartbeatToken = (storedToken, providedToken) => {
  const normalizedStored =
    typeof storedToken === 'string' ? storedToken.trim() : '';
  const normalizedProvided =
    typeof providedToken === 'string' ? providedToken.trim() : '';

  return Boolean(normalizedStored) && normalizedStored === normalizedProvided;
};

export const receiveHeartbeat = async (req, res) => {
  const { id } = req.params;
  const monitorId = Number(id);
  const authHeader =
    typeof req.headers.authorization === 'string'
      ? req.headers.authorization
      : '';
  const bearerToken = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : '';
  const queryToken = Array.isArray(req.query.token)
    ? req.query.token[0]
    : req.query.token;
  const providedToken =
    queryToken ||
    req.headers['x-pulsegrid-token'] ||
    req.headers['x-heartbeat-token'] ||
    bearerToken;

  if (!Number.isSafeInteger(monitorId) || monitorId <= 0) {
    return res.status(400).json({ message: 'A valid monitor ID is required.' });
  }

  try {
    const { rows } = await query(
      `SELECT id, name, type, status, heartbeat_secret
       FROM monitors
       WHERE id = $1 AND type = 'cron';`,
      [monitorId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Cron monitor not found.' });
    }

    const monitor = rows[0];
    if (!validateHeartbeatToken(monitor.heartbeat_secret, providedToken)) {
      return res.status(401).json({
        message: 'Unauthorized: a valid heartbeat token is required.',
      });
    }

    await query(
      `UPDATE monitors
       SET status = 'up', last_checked_at = NOW(), last_latency_ms = 0
       WHERE id = $1 AND type = 'cron';`,
      [monitorId],
    );

    await redis.hmset(`monitor:${monitorId}`, {
      status: 'up',
      consecutive_fails: 0,
      last_checked: Date.now(),
    });

    const checkRecord = {
      monitor_id: monitorId,
      status: 'up',
      latency_ms: 0,
      error: null,
      created_at: new Date().toISOString(),
    };

    // Buffer in Redis ring buffer for dashboard
    void redis
      .lpush(`monitor:${monitorId}:checks`, JSON.stringify(checkRecord))
      .then(() => redis.ltrim(`monitor:${monitorId}:checks`, 0, 29))
      .catch(() => {});

    // Queue for Write-Behind batch database flush
    void redis
      .rpush('telemetry:buffer', JSON.stringify(checkRecord))
      .catch(() => {});

    if (monitor.status === 'down') {
      void sendTelegramAlert({
        monitor,
        eventType: 'recovery',
        latency: 0,
      });
    }

    return res.status(200).json({
      status: 'ok',
      message: 'Heartbeat recorded successfully.',
    });
  } catch (error) {
    console.error('Heartbeat recording failed:', error.message);
    return res.status(500).json({ message: 'Unable to record heartbeat.' });
  }
};
