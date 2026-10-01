import { redis } from '../config/redis.js';
import { query } from '../config/db.js';

export const recordProbeResult = async (monitor, probeResult) => {
  if (!monitor?.id || !['up', 'down'].includes(probeResult?.status)) {
    throw new TypeError('A monitor ID and valid probe result are required.');
  }

  const key = `monitor:${monitor.id}`;
  const lastChecked = Date.now();
  const previousStatus = await redis.hget(key, 'status');

  // Persist check telemetry to PostgreSQL
  void query(
    'INSERT INTO monitor_checks (monitor_id, status, latency_ms, error) VALUES ($1, $2, $3, $4)',
    [
      monitor.id,
      probeResult.status,
      probeResult.latency || 0,
      probeResult.error || null,
    ],
  ).catch((e) =>
    console.error(
      `Failed to record check telemetry for monitor ${monitor.id}:`,
      e.message,
    ),
  );

  // Maintain fast 30-item ring buffer in Redis
  void redis
    .lpush(
      `monitor:${monitor.id}:checks`,
      JSON.stringify({
        status: probeResult.status,
        latency_ms: probeResult.latency || 0,
        error: probeResult.error || null,
        created_at: new Date(lastChecked).toISOString(),
      }),
    )
    .then(() => redis.ltrim(`monitor:${monitor.id}:checks`, 0, 29))
    .catch(() => {});

  if (probeResult.status === 'up') {
    await redis.hmset(key, {
      status: 'up',
      latency: probeResult.latency,
      last_checked: lastChecked,
      consecutive_fails: 0,
    });

    return {
      finalStatus: 'up',
      shouldAlert: false,
      shouldRecover: previousStatus === 'down',
    };
  }

  const fails = await redis.hincrby(key, 'consecutive_fails', 1);
  const finalStatus = fails < 3 ? 'pending_down' : 'down';

  await redis.hmset(key, {
    status: finalStatus,
    latency: probeResult.latency,
    last_checked: lastChecked,
    consecutive_fails: fails,
  });

  return {
    finalStatus,
    shouldAlert: fails === 3,
    shouldRecover: false,
  };
};
