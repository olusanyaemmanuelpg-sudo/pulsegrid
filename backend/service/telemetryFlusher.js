import { redis } from '../config/redis.js';
import { query } from '../config/db.js';

let isFlushing = false;

/**
 * Drains buffered telemetry from Redis and executes a single multi-row batch INSERT into PostgreSQL.
 */
export const flushTelemetryBuffer = async (batchSize = 100) => {
  if (isFlushing) return;
  isFlushing = true;

  try {
    // 1. Atomically pop up to batchSize items from the Redis buffer
    let rawItems = [];
    try {
      const popped = await redis.lpop('telemetry:buffer', batchSize);
      if (Array.isArray(popped)) {
        rawItems = popped;
      } else if (popped) {
        rawItems = [popped];
      }
    } catch {
      // Fallback if Redis version does not support count in LPOP
      const pipeline = redis.pipeline();
      pipeline.lrange('telemetry:buffer', 0, batchSize - 1);
      pipeline.ltrim('telemetry:buffer', batchSize, -1);
      const res = await pipeline.exec();
      rawItems = res?.[0]?.[1] || [];
    }

    if (!rawItems || rawItems.length === 0) return;

    // 2. Parse items
    const items = rawItems
      .map((r) => {
        try {
          return JSON.parse(r);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    if (items.length === 0) return;

    // 3. Build a single parameterized multi-row SQL query:
    // INSERT INTO monitor_checks (...) VALUES ($1,$2,$3,$4,$5), ($6,$7,$8,$9,$10)...
    const values = [];
    const placeholders = [];

    items.forEach((item, index) => {
      const offset = index * 5;
      placeholders.push(
        `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`,
      );
      values.push(
        item.monitor_id,
        item.status,
        item.latency_ms ?? 0,
        item.error ?? null,
        item.created_at || new Date().toISOString(),
      );
    });

    const sql = `
      INSERT INTO monitor_checks (monitor_id, status, latency_ms, error, created_at)
      VALUES ${placeholders.join(', ')};
    `;

    await query(sql, values);
    console.log(
      `📦 [Write-Behind Buffer] Flushed ${items.length} check(s) to PostgreSQL in 1 single batch query.`,
    );
  } catch (err) {
    console.error('❌ [Write-Behind Buffer] Batch flush error:', err.message);
  } finally {
    isFlushing = false;
  }
};

/**
 * Starts the periodic background buffer flusher (e.g. every 15 seconds).
 */
export const startTelemetryFlusher = (intervalMs = 15000) => {
  console.log(
    `⚡ [Write-Behind Engine] Telemetry flusher started (Draining buffer every ${intervalMs / 1000}s)...`,
  );
  return setInterval(flushTelemetryBuffer, intervalMs);
};
