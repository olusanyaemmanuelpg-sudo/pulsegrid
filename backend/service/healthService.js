import { redis } from '../config/redis.js';

export const recordProbeResult = async (monitor, probeResult) => {
  if (!monitor?.id || !['up', 'down'].includes(probeResult?.status)) {
    throw new TypeError('A monitor ID and valid probe result are required.');
  }

  const key = `monitor:${monitor.id}`;
  const lastChecked = Date.now();
  const previousStatus = await redis.hget(key, 'status');

  const checkRecord = {
    monitor_id: monitor.id,
    status: probeResult.status,
    latency_ms: probeResult.latency || 0,
    error: probeResult.error || null,
    created_at: new Date(lastChecked).toISOString(),
  };

  // 1. Maintain fast 30-item in-memory ring buffer for the dashboard
  void redis
    .lpush(`monitor:${monitor.id}:checks`, JSON.stringify(checkRecord))
    .then(() => redis.ltrim(`monitor:${monitor.id}:checks`, 0, 29))
    .catch(() => {});

  // 2. Push to Write-Behind Buffer (queued for bulk database flush)
  void redis
    .rpush('telemetry:buffer', JSON.stringify(checkRecord))
    .catch((e) =>
      console.error('Failed to buffer telemetry in Redis:', e.message),
    );

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
