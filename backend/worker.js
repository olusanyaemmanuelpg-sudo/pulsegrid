import dotenv from 'dotenv';
import { query, closePools } from './config/db.js';
import { redis } from './config/redis.js';
import {
  startWorkerHeartbeat,
  stopWorkerHeartbeat,
  unregisterWorker,
  MY_WORKER_ID,
} from './service/workerRegistry.js';
import { startScheduler, stopScheduler } from './service/scheduler.js';
import {
  startTelemetryFlusher,
  stopTelemetryFlusher,
  flushTelemetryBuffer,
} from './service/telemetryFlusher.js';
import { startAlertWorker, stopAlertWorker } from './service/alertBroker.js';

dotenv.config();

console.log(`⚡ [PulseGrid Prober Node] Initializing worker "${MY_WORKER_ID}"...`);

let isShuttingDown = false;

const handleShutdown = async (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`🛑 [${MY_WORKER_ID}] Received ${signal}, initiating graceful shutdown...`);

  // Watchdog timer: forcefully kill if cleanup hangs
  const forceExitTimeout = setTimeout(() => {
    console.error(`⚠️ [${MY_WORKER_ID}] Graceful shutdown timed out (10s). Forcing exit.`);
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  try {
    // 1. Stop scheduler and alert worker to cease pulling new tasks
    stopScheduler();
    stopAlertWorker();
    stopWorkerHeartbeat();

    // 2. Deregister from Consistent Hash Ring immediately so peers rebalance with zero delay
    await unregisterWorker(MY_WORKER_ID);

    // 3. Perform final flush of in-memory telemetry buffer to PostgreSQL
    console.log(`📦 [${MY_WORKER_ID}] Performing final telemetry buffer flush...`);
    await flushTelemetryBuffer(500);
    stopTelemetryFlusher();

    // 4. Drain and close database pools and Redis
    await closePools();
    await redis.quit();

    console.log(`✅ [${MY_WORKER_ID}] Graceful shutdown complete. Exiting.`);
    process.exit(0);
  } catch (err) {
    console.error(`❌ [${MY_WORKER_ID}] Error during graceful shutdown:`, err.message);
    process.exit(1);
  }
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

const bootWorker = async () => {
  try {
    await query('SELECT 1');
    console.log(`✅ [${MY_WORKER_ID}] Database connection established.`);

    // 1. Join Consistent Hash Ring via periodic Redis heartbeat
    startWorkerHeartbeat();

    // 2. Start probing scheduler (ticks every 10 seconds)
    startScheduler(Number(process.env.SCHEDULER_INTERVAL_MS || 10000));

    // 3. Start Write-Behind telemetry flusher (drains to PostgreSQL every 15s)
    startTelemetryFlusher(Number(process.env.FLUSHER_INTERVAL_MS || 15000));

    // 4. Start message broker alert consumer (drains alert:queue every 1s)
    startAlertWorker(Number(process.env.ALERT_WORKER_INTERVAL_MS || 1000));

    console.log(`🚀 [${MY_WORKER_ID}] Prober node fully operational.`);
  } catch (err) {
    console.error(`❌ [${MY_WORKER_ID}] Startup failed:`, err.message);
    process.exit(1);
  }
};

bootWorker();
