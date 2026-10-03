import dotenv from 'dotenv';
import { query } from './config/db.js';
import { startWorkerHeartbeat, MY_WORKER_ID } from './service/workerRegistry.js';
import { startScheduler } from './service/scheduler.js';
import { startTelemetryFlusher } from './service/telemetryFlusher.js';
import { startAlertWorker } from './service/alertBroker.js';

dotenv.config();

console.log(`⚡ [PulseGrid Prober Node] Initializing worker "${MY_WORKER_ID}"...`);

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
