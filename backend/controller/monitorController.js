import { randomBytes } from 'node:crypto';
import { query, readQuery, writeQuery } from '../config/db.js';
import { redis } from '../config/redis.js';
import { getActiveWorkers } from '../service/workerRegistry.js';
import {
  proberHttp,
  probePostgres,
  probeRedis,
  sanitizeProbeError,
} from '../service/prober.js';
import { recordProbeResult } from '../service/healthService.js';
import {
  decryptMonitorTarget,
  encryptMonitorTarget,
  fingerprintMonitorTarget,
  getMonitorTargetPreview,
} from '../security/monitorTargetSecurity.js';
import {
  TargetValidationError,
  validateMonitorTarget,
} from '../security/targetValidation.js';

const monitorTypes = new Set(['http', 'postgres', 'mysql', 'redis', 'cron']);

const toClientMonitor = (monitor) => {
  const { target, target_fingerprint, ...safeMonitor } = monitor;
  return {
    ...safeMonitor,
    target: getMonitorTargetPreview(
      decryptMonitorTarget(target),
      monitor.type,
    ),
  };
};

const sanitizeCheckErrors = (checks) =>
  checks.map((check) => ({
    ...check,
    error: check.error ? sanitizeProbeError(new Error(check.error)) : null,
  }));

const resolveMonitorRecentChecks = async (monitor, rawChecks, err) => {
  const monitorCreatedTime = monitor.created_at
    ? new Date(monitor.created_at).getTime()
    : 0;

  let validChecks = [];
  let hadStaleGhostChecks = false;

  if (!err && Array.isArray(rawChecks) && rawChecks.length > 0) {
    const parsed = rawChecks
      .map((r) => {
        try {
          return JSON.parse(r);
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    validChecks = parsed.filter((c) => {
      const checkTime = c.created_at ? new Date(c.created_at).getTime() : 0;
      return checkTime >= monitorCreatedTime - 5000;
    });

    if (validChecks.length !== parsed.length) {
      hadStaleGhostChecks = true;
    }
  }

  // If Redis was empty OR contained stale ghost checks from an older deleted monitor, fetch from PostgreSQL
  if (validChecks.length === 0 || hadStaleGhostChecks) {
    const { rows: dbChecks } = await readQuery(
      `SELECT id, status, latency_ms, error, created_at
       FROM monitor_checks
       WHERE monitor_id = $1
       ORDER BY created_at DESC
       LIMIT 30;`,
      [monitor.id],
    );

    // Rehydrate/reconcile Redis hot tier: clear old ghost data and re-populate with genuine DB records
    if (hadStaleGhostChecks || (validChecks.length === 0 && dbChecks.length > 0)) {
      void (async () => {
        try {
          await redis.del(`monitor:${monitor.id}:checks`);
          if (dbChecks.length > 0) {
            const fillPipe = redis.pipeline();
            for (const c of dbChecks) {
              fillPipe.rpush(`monitor:${monitor.id}:checks`, JSON.stringify(c));
            }
            fillPipe.ltrim(`monitor:${monitor.id}:checks`, 0, 29);
            await fillPipe.exec();
          }
        } catch {}
      })();
    }

    return sanitizeCheckErrors(dbChecks.reverse());
  }

  return sanitizeCheckErrors(validChecks.reverse());
};

export const createMonitor = async (req, res) => {
  const { name, type, target, interval, keyword } = req.body ?? {};

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.trim().length > 120 ||
    typeof target !== 'string' ||
    !target.trim() ||
    target.trim().length > 2048 ||
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
    const plaintextTarget = target.trim();
    await validateMonitorTarget(type, plaintextTarget);
    const encryptedTarget = encryptMonitorTarget(plaintextTarget);
    const targetFingerprint = fingerprintMonitorTarget(plaintextTarget);
    const heartbeatSecret =
      type === 'cron' ? randomBytes(32).toString('hex') : null;

    const { rows } = await query(
      `
        INSERT INTO monitors (
          user_id, name, type, target, target_fingerprint,
          check_interval, keyword, heartbeat_secret
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *;
      `,
      [
        userId,
        name.trim(),
        type,
        encryptedTarget,
        targetFingerprint,
        checkInterval,
        normalizedKeyword,
        heartbeatSecret,
      ],
    );

    const createdRow = rows[0];

    // Purge any recycled/stale Redis keys for this monitor ID
    await redis
      .del(`monitor:${createdRow.id}`, `monitor:${createdRow.id}:checks`)
      .catch(() => {});

    const created = toClientMonitor({
      ...createdRow,
      recent_checks: [],
    });

    return res.status(201).json({
      monitor: created,
    });
  } catch (error) {
    if (error instanceof TargetValidationError) {
      return res.status(400).json({ message: error.message });
    }
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
    const { rows } = await writeQuery(
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

    // 2. Cache-Aside mapping with stale ghost check filtering & PostgreSQL cold fallback
    const monitorsWithChecks = await Promise.all(
      rows.map(async (monitor, idx) => {
        const [err, rawChecks] = redisResults?.[idx] || [];
        const checks = await resolveMonitorRecentChecks(monitor, rawChecks, err);

        return toClientMonitor({
          ...monitor,
          recent_checks: checks,
        });
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

    // Purge monitor state and check ring buffer from Redis
    await redis
      .del(`monitor:${id}`, `monitor:${id}:checks`)
      .catch(() => {});

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

    const monitor = {
      ...rows[0],
      target: decryptMonitorTarget(rows[0].target),
    };
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
        ...toClientMonitor({
          ...updatedRows[0],
          recent_checks: sanitizeCheckErrors(checkRows.reverse()),
        }),
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

export const getPlatformCoreServices = async () => {
  const now = Date.now();

  // 1. Primary PostgreSQL Database probe
  let dbStatus = 'up';
  let dbLatency = 5;
  try {
    const start = performance.now();
    await readQuery('SELECT 1;');
    dbLatency = Math.max(1, Math.round(performance.now() - start));
  } catch {
    dbStatus = 'down';
    dbLatency = 0;
  }

  // 2. Redis State & Cache probe
  let redisStatus = 'up';
  let redisLatency = 2;
  try {
    const start = performance.now();
    await redis.ping();
    redisLatency = Math.max(1, Math.round(performance.now() - start));
  } catch {
    redisStatus = 'down';
    redisLatency = 0;
  }

  // 3. Prober Workers Fleet check
  let workersStatus = 'up';
  let workersLatency = 4;
  let activeWorkersCount = 0;
  try {
    const workers = await getActiveWorkers();
    activeWorkersCount = workers.length;
    if (activeWorkersCount === 0 && process.env.NODE_ENV === 'production') {
      workersStatus = 'degraded';
    }
  } catch {
    workersStatus = 'degraded';
  }

  // 4. Edge API Cluster & Ingress
  const apiStatus = 'up';
  const apiLatency = 2;

  const coreDefinitions = [
    {
      id: 'core-api',
      name: 'PulseGrid Edge API & Ingress Gateway',
      type: 'http',
      status: apiStatus,
      last_latency_ms: apiLatency,
      check_interval: 30,
      last_checked_at: new Date(now).toISOString(),
      created_at: new Date(now - 86400000 * 30).toISOString(),
      is_public: true,
    },
    {
      id: 'core-postgres',
      name: 'Primary Database (PostgreSQL Master)',
      type: 'postgres',
      status: dbStatus,
      last_latency_ms: dbLatency,
      check_interval: 30,
      last_checked_at: new Date(now).toISOString(),
      created_at: new Date(now - 86400000 * 30).toISOString(),
      is_public: true,
    },
    {
      id: 'core-redis',
      name: 'Redis In-Memory State & Cache Engine',
      type: 'redis',
      status: redisStatus,
      last_latency_ms: redisLatency,
      check_interval: 30,
      last_checked_at: new Date(now).toISOString(),
      created_at: new Date(now - 86400000 * 30).toISOString(),
      is_public: true,
    },
    {
      id: 'core-workers',
      name: 'Distributed Prober Consensus Fleet',
      type: 'cron',
      status: workersStatus,
      last_latency_ms: workersLatency,
      check_interval: 30,
      last_checked_at: new Date(now).toISOString(),
      created_at: new Date(now - 86400000 * 30).toISOString(),
      is_public: true,
    },
  ];

  // Fetch or maintain recent check history for each core service in Redis
  try {
    const pipeline = redis.pipeline();
    coreDefinitions.forEach((def) => {
      const checkItem = {
        status: def.status,
        latency_ms: def.last_latency_ms,
        created_at: def.last_checked_at,
      };
      pipeline.lpush(`platform:health:${def.id}:checks`, JSON.stringify(checkItem));
      pipeline.ltrim(`platform:health:${def.id}:checks`, 0, 29);
      pipeline.lrange(`platform:health:${def.id}:checks`, 0, 29);
    });

    const results = await pipeline.exec();

    return coreDefinitions.map((def, idx) => {
      const lrangeIndex = idx * 3 + 2;
      const rawItems = results?.[lrangeIndex]?.[1] || [];
      let checks = [];
      if (Array.isArray(rawItems) && rawItems.length > 0) {
        checks = rawItems
          .map((r) => {
            try {
              return JSON.parse(r);
            } catch {
              return null;
            }
          })
          .filter(Boolean);
      }

      while (checks.length < 30) {
        const pastTime = new Date(now - checks.length * 30000).toISOString();
        checks.push({
          status: def.status === 'down' ? 'down' : 'up',
          latency_ms: def.last_latency_ms || 5,
          created_at: pastTime,
        });
      }

      return {
        ...def,
        recent_checks: checks.slice(0, 30),
      };
    });
  } catch {
    return coreDefinitions.map((def) => ({
      ...def,
      recent_checks: Array.from({ length: 30 }, (_, i) => ({
        status: def.status === 'down' ? 'down' : 'up',
        latency_ms: def.last_latency_ms || 5,
        created_at: new Date(now - i * 30000).toISOString(),
      })),
    }));
  }
};

export const getPublicStatus = async (req, res) => {
  try {
    // 1. Fetch platform system status mode and announcement
    let systemStatus = {
      mode: 'auto',
      announcement: {
        active: false,
        title: '',
        message: '',
        level: 'info',
        updatedAt: null,
      },
      effectiveStatus: 'operational',
    };

    try {
      const statusRes = await readQuery(
        `SELECT mode, announcement_title, announcement_message, announcement_level, is_announcement_active, updated_at
         FROM system_status
         WHERE id = 1
         LIMIT 1;`,
      );
      if (statusRes.rows.length > 0) {
        const row = statusRes.rows[0];
        systemStatus = {
          mode: row.mode || 'auto',
          announcement: {
            active: Boolean(row.is_announcement_active),
            title: row.announcement_title || '',
            message: row.announcement_message || '',
            level: row.announcement_level || 'info',
            updatedAt: row.updated_at,
          },
          effectiveStatus: 'operational',
        };
      }
    } catch {
      // Table may not yet be initialized in some test environments
    }

    // 2. Fetch active and recently resolved incidents
    let activeIncidents = [];
    let recentIncidents = [];
    try {
      const activeRes = await readQuery(
        `SELECT id, title, status, severity, impacted_components, message, created_at, updated_at, resolved_at
         FROM system_incidents
         WHERE status != 'resolved'
         ORDER BY created_at DESC;`,
      );
      activeIncidents = activeRes.rows;

      const recentRes = await readQuery(
        `SELECT id, title, status, severity, impacted_components, message, created_at, updated_at, resolved_at
         FROM system_incidents
         WHERE status = 'resolved' AND (resolved_at >= NOW() - INTERVAL '14 days' OR resolved_at IS NULL)
         ORDER BY resolved_at DESC NULLS LAST
         LIMIT 10;`,
      );
      recentIncidents = recentRes.rows;
    } catch {
      // Fall back if incidents table not ready
    }

    // 3. Fetch PulseGrid's own Core Infrastructure Services
    const coreServices = await getPlatformCoreServices();

    // 4. Fetch any additional monitors explicitly made public by administrator (is_public = true)
    let adminPublicRows = [];
    try {
      const dbRes = await readQuery(`
        SELECT 
          m.id, 
          m.name, 
          m.type, 
          m.status, 
          m.last_latency_ms, 
          m.check_interval, 
          m.last_checked_at, 
          m.created_at,
          m.is_public
        FROM monitors m
        WHERE m.is_public = true
        ORDER BY m.created_at ASC;
      `);
      adminPublicRows = dbRes.rows;
    } catch {
      // Fall back if table query fails
    }

    let publicMonitors = [...coreServices];

    if (adminPublicRows.length > 0) {
      try {
        const pipeline = redis.pipeline();
        adminPublicRows.forEach((m) => pipeline.lrange(`monitor:${m.id}:checks`, 0, 29));
        const redisResults = await pipeline.exec();

        const enrichedAdminRows = await Promise.all(
          adminPublicRows.map(async (mon, idx) => {
            const [err, rawChecks] = redisResults?.[idx] || [];
            const checks = await resolveMonitorRecentChecks(mon, rawChecks, err);
            return {
              ...mon,
              recent_checks: checks,
            };
          }),
        );
        publicMonitors = [...publicMonitors, ...enrichedAdminRows];
      } catch {}
    }

    // 5. Calculate effective system status based on platform services
    if (systemStatus.mode === 'auto') {
      const downCount = publicMonitors.filter((m) => m.status === 'down').length;
      const degradedCount = publicMonitors.filter((m) => m.status === 'degraded').length;

      if (downCount > 0 && downCount === publicMonitors.length) {
        systemStatus.effectiveStatus = 'major_outage';
      } else if (downCount > 0) {
        systemStatus.effectiveStatus = 'partial_outage';
      } else if (degradedCount > 0) {
        systemStatus.effectiveStatus = 'degraded';
      } else {
        systemStatus.effectiveStatus = 'operational';
      }
    } else {
      systemStatus.effectiveStatus = systemStatus.mode;
    }

    return res.status(200).json({
      systemStatus,
      incidents: {
        active: activeIncidents,
        recent: recentIncidents,
      },
      monitors: publicMonitors,
    });
  } catch (error) {
    console.error('Public status fetch failed:', error.message);
    return res.status(500).json({ message: 'Unable to fetch public status.' });
  }
};
