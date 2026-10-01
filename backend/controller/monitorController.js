import { query } from '../config/db.js';
import { redis } from '../config/redis.js';
import { proberHttp, probePostgres, probeRedis } from '../service/prober.js';
import { recordProbeResult } from '../service/healthService.js';

const monitorTypes = new Set(['http', 'postgres', 'mysql', 'redis', 'cron']);

export const createMonitor = async (req, res) => {
  const { name, type, target, interval, keyword } = req.body ?? {};

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 120 ||
    typeof target !== 'string' ||
    !target.trim() ||
    typeof type !== 'string' ||
    !monitorTypes.has(type) ||
    (keyword !== undefined && keyword !== null && typeof keyword !== 'string')
  ) {
    return res
      .status(400)
      .json({ message: 'A valid name, type, and target are required.' });
  }

  const checkInterval = interval ?? 30;
  if (
    !Number.isInteger(checkInterval) ||
    checkInterval <= 0 ||
    checkInterval > 2147483647
  ) {
    return res
      .status(400)
      .json({ message: 'Interval must be a positive integer.' });
  }

  const normalizedKeyword = keyword?.trim() || null;
  if (normalizedKeyword && normalizedKeyword.length > 100) {
    return res
      .status(400)
      .json({ message: 'Keyword must be 100 characters or fewer.' });
  }

  const userId = req.user.id;

  try {
    const { rows } = await query(
      `
        INSERT INTO monitors (user_id, name, type, target, check_interval, keyword)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *;
    `,
      [
        userId,
        name.trim(),
        type,
        target.trim(),
        checkInterval,
        normalizedKeyword,
      ],
    );

    const created = {
      ...rows[0],
      recent_checks: [],
    };

    return res.status(201).json({
      monitor: created,
    });
  } catch (error) {
    if (error.code === '23505') {
      return res
        .status(409)
        .json({ message: 'A monitor with these settings already exists.' });
    }
    console.error('Monitor creation failed:', error.message);
    return res.status(500).json({ message: 'Unable to create monitor.' });
  }
};

export const getMonitors = async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await query(
      `SELECT * FROM monitors WHERE user_id = $1 ORDER BY created_at DESC;`,
      [userId],
    );

    if (rows.length === 0) {
      return res.status(200).json({ monitors: [] });
    }

    // 1. Pipeline fetch from Redis Hot Tier (< 1ms RAM lookup)
    const pipeline = redis.pipeline();
    rows.forEach((m) => pipeline.lrange(`monitor:${m.id}:checks`, 0, 29));
    const redisResults = await pipeline.exec();

    // 2. Cache-Aside mapping with PostgreSQL cold fallback
    const monitorsWithChecks = await Promise.all(
      rows.map(async (monitor, idx) => {
        const [err, rawChecks] = redisResults?.[idx] || [];
        let checks = [];

        if (!err && Array.isArray(rawChecks) && rawChecks.length > 0) {
          checks = rawChecks
            .map((r) => {
              try {
                return JSON.parse(r);
              } catch {
                return null;
              }
            })
            .filter(Boolean)
            .reverse();
        } else {
          // Cold-start fallback from PostgreSQL
          const { rows: dbChecks } = await query(
            `SELECT id, status, latency_ms, error, created_at
             FROM monitor_checks
             WHERE monitor_id = $1
             ORDER BY created_at DESC
             LIMIT 30;`,
            [monitor.id],
          );

          if (dbChecks.length > 0) {
            // Rehydrate Redis hot tier asynchronously
            const fillPipe = redis.pipeline();
            for (const c of dbChecks) {
              fillPipe.rpush(`monitor:${monitor.id}:checks`, JSON.stringify(c));
            }
            fillPipe.ltrim(`monitor:${monitor.id}:checks`, 0, 29);
            void fillPipe.exec().catch(() => {});
          }

          checks = dbChecks.reverse();
        }

        return {
          ...monitor,
          recent_checks: checks,
        };
      }),
    );

    return res.status(200).json({ monitors: monitorsWithChecks });
  } catch (error) {
    console.error('Monitor fetch failed:', error.message);
    return res.status(500).json({ message: 'Unable to fetch monitors.' });
  }
};

export const deleteMonitor = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'A valid monitor ID is required.' });
  }

  try {
    const { rows } = await query(
      'DELETE FROM monitors WHERE id = $1 AND user_id = $2 RETURNING id;',
      [id, req.user.id],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Monitor not found.' });

    return res.status(200).json({ message: 'Monitor deleted successfully.' });
  } catch (error) {
    console.error('Monitor delete failed:', error.message);
    return res.status(500).json({ message: 'Unable to delete monitor.' });
  }
};

export const testMonitor = async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({ message: 'A valid monitor ID is required.' });
  }

  const userId = req.user.id;

  try {
    const { rows } = await query(
      'SELECT * FROM monitors WHERE id = $1 AND user_id = $2;',
      [id, userId],
    );
    if (rows.length === 0)
      return res.status(404).json({ message: 'Monitor not found.' });

    const monitor = rows[0];
    let result;

    if (monitor.type === 'redis') {
      result = await probeRedis(monitor.target);
    } else if (monitor.type === 'postgres') {
      result = await probePostgres(monitor.target);
    } else if (monitor.type === 'cron') {
      const referenceTime = monitor.last_checked_at
        ? new Date(monitor.last_checked_at).getTime()
        : new Date(monitor.created_at).getTime();

      const elapsedSeconds = Math.floor((Date.now() - referenceTime) / 1000);
      const gracePeriod = Math.max(
        60,
        Math.floor(monitor.check_interval * 0.2),
      );
      const maxAllowedSeconds = monitor.check_interval + gracePeriod;

      result =
        elapsedSeconds > maxAllowedSeconds
          ? {
              status: 'down',
              latency: 0,
              error: 'Heartbeat overdue / missed deadline',
            }
          : { status: 'up', latency: 0, error: null };
    } else {
      result = await proberHttp(monitor.target, monitor.keyword);
    }

    const { finalStatus, shouldAlert } = await recordProbeResult(
      monitor,
      result,
    );
    const persistedStatus =
      finalStatus === 'pending_down' ? 'pending' : finalStatus;

    const { rows: updatedRows } = await query(
      `UPDATE monitors
       SET status = $1, 
           last_latency_ms = $2, 
           last_checked_at = CASE WHEN type = 'cron' THEN last_checked_at ELSE NOW() END
       WHERE id = $3 AND user_id = $4
       RETURNING *;`,
      [persistedStatus, result.latency, id, userId],
    );
    if (updatedRows.length === 0) {
      return res.status(404).json({ message: 'Monitor not found.' });
    }

    // Fetch updated recent checks
    const { rows: checkRows } = await query(
      `SELECT id, status, latency_ms, error, created_at
       FROM monitor_checks
       WHERE monitor_id = $1
       ORDER BY created_at DESC
       LIMIT 30;`,
      [id],
    );

    return res.status(200).json({
      monitor: {
        ...updatedRows[0],
        recent_checks: checkRows.reverse(),
      },
      finalStatus,
      shouldAlert,
      error: result.error,
    });
  } catch (error) {
    console.error('Monitor test failed:', error.message);
    return res.status(500).json({ message: 'Unable to test monitor.' });
  }
};

export const getPublicStatus = async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT 
        m.id, 
        m.name, 
        m.type, 
        m.status, 
        m.last_latency_ms, 
        m.check_interval, 
        m.last_checked_at, 
        m.created_at
      FROM monitors m
      ORDER BY m.created_at ASC;
    `);

    if (rows.length === 0) {
      return res.status(200).json({ monitors: [] });
    }

    const pipeline = redis.pipeline();
    rows.forEach((m) => pipeline.lrange(`monitor:${m.id}:checks`, 0, 29));
    const redisResults = await pipeline.exec();

    const publicMonitors = await Promise.all(
      rows.map(async (mon, idx) => {
        const [err, rawChecks] = redisResults?.[idx] || [];
        let checks = [];

        if (!err && Array.isArray(rawChecks) && rawChecks.length > 0) {
          checks = rawChecks
            .map((r) => {
              try {
                return JSON.parse(r);
              } catch {
                return null;
              }
            })
            .filter(Boolean)
            .reverse();
        } else {
          const { rows: dbChecks } = await query(
            `SELECT id, status, latency_ms, error, created_at
             FROM monitor_checks
             WHERE monitor_id = $1
             ORDER BY created_at DESC
             LIMIT 30;`,
            [mon.id],
          );

          if (dbChecks.length > 0) {
            const fillPipe = redis.pipeline();
            for (const c of dbChecks) {
              fillPipe.rpush(`monitor:${mon.id}:checks`, JSON.stringify(c));
            }
            fillPipe.ltrim(`monitor:${mon.id}:checks`, 0, 29);
            void fillPipe.exec().catch(() => {});
          }

          checks = dbChecks.reverse();
        }

        return {
          ...mon,
          target:
            mon.type === 'http'
              ? mon.target
              : `${mon.type}://[protected-endpoint]`,
          recent_checks: checks,
        };
      }),
    );

    return res.status(200).json({ monitors: publicMonitors });
  } catch (error) {
    console.error('Public status fetch failed:', error.message);
    return res.status(500).json({ message: 'Unable to fetch public status.' });
  }
};
