import { redis } from '../config/redis.js';

export const recordProbeResult = async (monitor, probeResult) => {
  if (!monitor?.id || !['up', 'down'].includes(probeResult?.status)) {
    throw new TypeError('A monitor ID and valid probe result are required.');
  }

  const key = `monitor:${monitor.id}`;
  const lastChecked = Date.now();

  if (probeResult.status === 'up') {
    await redis.hmset(key, {
      status: 'up',
      latency: probeResult.latency,
      last_checked: lastChecked,
      consecutive_fails: 0,
    });

    return { finalStatus: 'up', shouldAlert: false };
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
  };
};
