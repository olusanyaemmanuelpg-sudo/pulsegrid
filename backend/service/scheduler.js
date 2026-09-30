import { query } from '../config/db.js';
import { proberHttp } from './prober.js';
import { recordProbeResult } from './healthService.js';

let isProcessing = false;

export const checkMonitor = async (monitor) => {
  try {
    const probeResult = await proberHttp(monitor.target, monitor.keyword);
    const antiFlap = await recordProbeResult(monitor, probeResult);
    const persistedStatus =
      antiFlap.finalStatus === 'pending_down'
        ? 'pending'
        : antiFlap.finalStatus;

    await query(
      `UPDATE monitors 
       SET status = $1, last_latency_ms = $2, last_checked_at = NOW() 
       WHERE id = $3`,
      [persistedStatus, probeResult.latency, monitor.id],
    );

    if (antiFlap.shouldAlert) {
      console.log(
        `🚨 [ALERT TRIGGERED] Monitor "${monitor.name}" (${monitor.target}) is CONFIRMED DOWN! Strike 3 reached.`,
      );
    }
  } catch (error) {
    console.error(`Error checking monitor ${monitor.id}:`, error.message);
  }
};

export const runSchedulerCycle = async () => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const { rows: dueMonitors } = await query(
      `SELECT * FROM monitors
       WHERE type = 'http'
         AND (last_checked_at IS NULL
           OR NOW() - last_checked_at >= (check_interval * INTERVAL '1 second'))
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
