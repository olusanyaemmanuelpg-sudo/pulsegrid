import { query } from '../config/db.js';
import { redis } from '../config/redis.js';
import { sendTelegramAlert } from '../service/alertServices.js';

export const receiveHeartbeat = async (req, res) => {
  const { id } = req.params;
  const monitorId = Number(id);

  if (!Number.isSafeInteger(monitorId) || monitorId <= 0) {
    return res.status(400).json({ message: 'A valid monitor ID is required.' });
  }

  try {
    const { rows } = await query(
      `SELECT id, name, type, target, status
       FROM monitors
       WHERE id = $1 AND type = 'cron';`,
      [monitorId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Cron monitor not found.' });
    }
    const monitor = rows[0];

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

    void query(
      'INSERT INTO monitor_checks (monitor_id, status, latency_ms, error) VALUES ($1, $2, $3, $4)',
      [monitorId, 'up', 0, null],
    ).catch(() => {});

    void redis
      .lpush(
        `monitor:${monitorId}:checks`,
        JSON.stringify({
          status: 'up',
          latency_ms: 0,
          error: null,
          created_at: new Date().toISOString(),
        }),
      )
      .then(() => redis.ltrim(`monitor:${monitorId}:checks`, 0, 29))
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
