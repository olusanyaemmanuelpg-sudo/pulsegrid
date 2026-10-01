import { redis } from '../config/redis.js';

// Each process has a worker ID (e.g. passed via WORKER_ID=worker-1 or auto-generated)
export const MY_WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;

const REGISTRY_SET = 'workers:active';
const HEARTBEAT_TTL_SEC = 15;

/**
 * Sends a periodic heartbeat into Redis with a 15-second TTL.
 * If this worker dies, Redis automatically removes it.
 */
export const registerWorkerHeartbeat = async () => {
  const key = `worker:heartbeat:${MY_WORKER_ID}`;
  try {
    const pipeline = redis.pipeline();
    pipeline.set(key, Date.now(), 'EX', HEARTBEAT_TTL_SEC);
    pipeline.sadd(REGISTRY_SET, MY_WORKER_ID);
    await pipeline.exec();
  } catch (err) {
    console.error('❌ [WorkerRegistry] Heartbeat failed:', err.message);
  }
};

/**
 * Discovers all currently healthy workers across the cluster.
 * Cleans up dead workers whose TTL expired.
 */
export const getActiveWorkers = async () => {
  try {
    const workers = await redis.smembers(REGISTRY_SET);
    if (!workers || workers.length === 0) {
      return [MY_WORKER_ID];
    }

    // Check which workers still have an active TTL heartbeat
    const pipeline = redis.pipeline();
    workers.forEach((w) => pipeline.exists(`worker:heartbeat:${w}`));
    const results = await pipeline.exec();

    const healthyWorkers = [];
    const deadWorkers = [];

    workers.forEach((w, idx) => {
      const exists = results[idx]?.[1] === 1;
      if (exists) {
        healthyWorkers.push(w);
      } else {
        deadWorkers.push(w);
      }
    });

    // Prune dead workers from the active set
    if (deadWorkers.length > 0) {
      await redis.srem(REGISTRY_SET, ...deadWorkers);
    }

    return healthyWorkers.length > 0 ? healthyWorkers : [MY_WORKER_ID];
  } catch (err) {
    console.error('❌ [WorkerRegistry] Discovery error:', err.message);
    return [MY_WORKER_ID];
  }
};

/**
 * Starts sending heartbeats every 5 seconds.
 */
export const startWorkerHeartbeat = () => {
  console.log(`🏷️ [Worker Node] Registered as: ${MY_WORKER_ID}`);
  registerWorkerHeartbeat();
  return setInterval(registerWorkerHeartbeat, 5000);
};
