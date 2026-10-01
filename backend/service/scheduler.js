import { query } from '../config/db.js';
import { proberHttp, probePostgres, probeRedis } from './prober.js';
import { recordProbeResult } from './healthService.js';
import { sendTelegramAlert } from './alertServices.js';

let isProcessing = false;

export const checkMonitor = async (monitor) => {
  try {
    let probeResult;
    if (monitor.type === 'redis') {
      probeResult = await probeRedis(monitor.target, monitor.keyword);
    } else if (monitor.type === 'postgres') {
      probeResult = await probePostgres(monitor.target);
    } else if (monitor.type === 'cron') {
      // If no heartbeat has arrived yet, count time from monitor creation
      const referenceTime = monitor.last_checked_at
        ? new Date(monitor.last_checked_at).getTime()
        : new Date(monitor.created_at).getTime();

      const elapsedSeconds = Math.floor((Date.now() - referenceTime) / 1000);
      const gracePeriod = Math.max(
        60,
        Math.floor(monitor.check_interval * 0.2),
      );
      const maxAllowedSeconds = monitor.check_interval + gracePeriod;

      // If the cron monitor is NOT overdue, do not log fake checks or updates!
      if (elapsedSeconds <= maxAllowedSeconds) {
        return;
      }

      probeResult = {
        status: 'down',
        latency: 0,
        error: 'Heartbeat overdue / missed deadline',
      };
    } else {
      probeResult = await proberHttp(monitor.target, monitor.keyword);
    }

    const antiFlap = await recordProbeResult(monitor, probeResult);
    const persistedStatus =
      antiFlap.finalStatus === 'pending_down'
        ? 'pending'
        : antiFlap.finalStatus;

    await query(
      `UPDATE monitors 
         SET status = $1,
           last_latency_ms = $2,
           last_checked_at = CASE WHEN type = 'cron' THEN last_checked_at ELSE NOW() END
       WHERE id = $3`,
      [persistedStatus, probeResult.latency, monitor.id],
    );

    if (antiFlap.shouldAlert) {
      console.log(
        `🚨 [ALERT TRIGGERED] Monitor "${monitor.name}" (${monitor.target}) is CONFIRMED DOWN! Strike 3 reached.`,
      );
      void sendTelegramAlert({
        monitor,
        eventType: 'down',
        error: probeResult.error,
      });
    } else if (antiFlap.shouldRecover) {
      void sendTelegramAlert({
        monitor,
        eventType: 'recovery',
        latency: probeResult.latency,
      });
    }
  } catch (error) {
    console.error(`Error checking monitor ${monitor.id}:`, error.message);
  }
};

let lastPruneTime = 0;

const pruneOldChecks = async () => {
  const now = Date.now();
  // Prune once every 30 minutes to prevent database bloat
  if (now - lastPruneTime < 30 * 60 * 1000) return;
  lastPruneTime = now;

  try {
    await query(`
      DELETE FROM monitor_checks
      WHERE created_at < NOW() - INTERVAL '24 hours';
    `);
  } catch (err) {
    console.error('Telemetry pruning error:', err.message);
  }
};

export const runSchedulerCycle = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    void pruneOldChecks();

    const { rows: dueMonitors } = await query(
      `SELECT * FROM monitors
        WHERE (
          -- Outbound probers (HTTP, Postgres, Redis): probe when check_interval elapses
          (type IN ('http', 'redis', 'postgres') AND (
            last_checked_at IS NULL
            OR NOW() - last_checked_at >= (check_interval * INTERVAL '1 second')
          ))
          OR
          -- Cron monitors: ONLY evaluate if not already DOWN and overdue past interval + grace period
          (type = 'cron' AND status != 'down' AND (
            (last_checked_at IS NOT NULL AND NOW() - last_checked_at >= (check_interval + GREATEST(60, check_interval * 0.2)) * INTERVAL '1 second')
            OR
            (last_checked_at IS NULL AND NOW() - created_at >= (check_interval + GREATEST(60, check_interval * 0.2)) * INTERVAL '1 second')
          ))
        )
       LIMIT 50;`,
    );

    if (dueMonitors.length > 0) {
      console.log(
        `⏰ [Scheduler] Running automated checks for ${dueMonitors.length} due monitor(s)...`,
      );
      // Run all checks concurrently
      await Promise.allSettled(dueMonitors.map(checkMonitor));
    }
  } catch (err) {
    console.error('Scheduler cycle error:', err.message);
  } finally {
    isProcessing = false;
  }
};

export const startScheduler = (intervalMs = 10000) => {
  console.log(
    `⚡ [Scheduler] PulseGrid background worker started (Ticking every ${intervalMs / 1000}s)...`,
  );
  // Run once immediately, then on an interval
  runSchedulerCycle();
  return setInterval(runSchedulerCycle, intervalMs);
};
