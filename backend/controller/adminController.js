import { query, readQuery } from '../config/db.js';
import { redis } from '../config/redis.js';
import { getActiveWorkers } from '../service/workerRegistry.js';
import { isUsingDedicatedReplica } from '../config/db.js';
import {
  decryptMonitorTarget,
  getMonitorTargetPreview,
} from '../security/monitorTargetSecurity.js';

/**
 * Returns platform-wide system metrics, user growth, monitor statuses,
 * and cluster pipeline telemetry.
 */
export const getAdminOverview = async (req, res) => {
  try {
    // 1. User metrics
    const usersResult = await readQuery(`
      SELECT 
        COUNT(*)::int AS total_users,
        COUNT(CASE WHEN created_at >= NOW() - INTERVAL '7 days' THEN 1 END)::int AS new_users_this_week
      FROM users;
    `);
    const { total_users, new_users_this_week } = usersResult.rows[0] || {
      total_users: 0,
      new_users_this_week: 0,
    };

    // 2. Monitor status & type distribution
    const monitorsResult = await readQuery(`
      SELECT 
        COUNT(*)::int AS total_monitors,
        COUNT(CASE WHEN status = 'up' THEN 1 END)::int AS up_count,
        COUNT(CASE WHEN status = 'down' THEN 1 END)::int AS down_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END)::int AS pending_count,
        COUNT(CASE WHEN type = 'http' THEN 1 END)::int AS http_count,
        COUNT(CASE WHEN type = 'postgres' THEN 1 END)::int AS postgres_count,
        COUNT(CASE WHEN type = 'redis' THEN 1 END)::int AS redis_count,
        COUNT(CASE WHEN type = 'cron' THEN 1 END)::int AS cron_count
      FROM monitors;
    `);
    const monitorStats = monitorsResult.rows[0] || {
      total_monitors: 0,
      up_count: 0,
      down_count: 0,
      pending_count: 0,
      http_count: 0,
      postgres_count: 0,
      redis_count: 0,
      cron_count: 0,
    };

    // 3. Historical check activity (last 24 hours)
    let checksLast24Hours = 0;
    try {
      const checksResult = await readQuery(`
        SELECT COUNT(*)::bigint AS checks_24h
        FROM monitor_checks
        WHERE created_at >= NOW() - INTERVAL '24 hours';
      `);
      checksLast24Hours = Number(checksResult.rows[0]?.checks_24h || 0);
    } catch {
      checksLast24Hours = 0;
    }

    // 4. Redis cluster buffers & worker ring
    let activeWorkers = [];
    let telemetryBufferDepth = 0;
    let alertQueueDepth = 0;
    let dlqDepth = 0;

    try {
      activeWorkers = await getActiveWorkers();
      telemetryBufferDepth = await redis.llen('telemetry:buffer');
      alertQueueDepth = await redis.llen('alert:queue');
      dlqDepth = await redis.llen('alert:dlq');
    } catch (redisErr) {
      console.warn('⚠️ [Admin Overview] Redis stats lookup failed:', redisErr.message);
    }

    return res.status(200).json({
      users: {
        total: total_users,
        newThisWeek: new_users_this_week,
      },
      monitors: {
        total: monitorStats.total_monitors,
        byStatus: {
          up: monitorStats.up_count,
          down: monitorStats.down_count,
          pending: monitorStats.pending_count,
        },
        byType: {
          http: monitorStats.http_count,
          postgres: monitorStats.postgres_count,
          redis: monitorStats.redis_count,
          cron: monitorStats.cron_count,
        },
      },
      checks: {
        last24Hours: checksLast24Hours,
      },
      cluster: {
        activeWorkers,
        workerCount: activeWorkers.length,
        telemetryBufferDepth,
        alertQueueDepth,
        dlqDepth,
        databaseTopology: {
          readReplicaEnabled: isUsingDedicatedReplica,
          mode: isUsingDedicatedReplica ? 'primary-replica' : 'primary-only',
        },
      },
    });
  } catch (err) {
    console.error('❌ [Admin Overview] Failed to fetch metrics:', err.message);
    return res.status(500).json({ message: 'Failed to retrieve administrative metrics.' });
  }
};

/**
 * Returns directory of all registered users with their onboarding date,
 * service count, and overall health status.
 */
export const getAdminUsers = async (req, res) => {
  try {
    const { rows } = await readQuery(`
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.role, 
        u.created_at,
        COUNT(m.id)::int AS total_monitors,
        COUNT(CASE WHEN m.status = 'up' THEN 1 END)::int AS up_monitors,
        COUNT(CASE WHEN m.status = 'down' THEN 1 END)::int AS down_monitors,
        COUNT(CASE WHEN m.status = 'pending' THEN 1 END)::int AS pending_monitors,
        MAX(m.last_checked_at) AS last_activity_at
      FROM users u
      LEFT JOIN monitors m ON u.id = m.user_id
      GROUP BY u.id
      ORDER BY u.created_at DESC;
    `);

    return res.status(200).json({
      users: rows,
      totalCount: rows.length,
    });
  } catch (err) {
    console.error('❌ [Admin Users] Failed to list users:', err.message);
    return res.status(500).json({ message: 'Failed to retrieve users directory.' });
  }
};

/**
 * Returns all platform services/monitors with owner details,
 * allowing admins to inspect services as user.
 */
export const getAdminMonitors = async (req, res) => {
  const { userId, status, type, search } = req.query;

  try {
    const conditions = [];
    const values = [];

    if (userId) {
      values.push(Number(userId));
      conditions.push(`m.user_id = $${values.length}`);
    }

    if (status && ['up', 'down', 'pending'].includes(status)) {
      values.push(status);
      conditions.push(`m.status = $${values.length}`);
    }

    if (type && ['http', 'postgres', 'redis', 'cron'].includes(type)) {
      values.push(type);
      conditions.push(`m.type = $${values.length}`);
    }

    if (search && typeof search === 'string' && search.trim()) {
      values.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(lower(m.name) LIKE $${values.length} OR lower(u.email) LIKE $${values.length} OR lower(u.name) LIKE $${values.length})`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        m.id,
        m.user_id,
        m.name,
        m.type,
        m.target,
        m.check_interval,
        m.keyword,
        m.status,
        m.last_latency_ms,
        m.last_checked_at,
        m.created_at,
        u.name AS user_name,
        u.email AS user_email
      FROM monitors m
      JOIN users u ON m.user_id = u.id
      ${whereClause}
      ORDER BY m.created_at DESC;
    `;

    const { rows } = await readQuery(sql, values);

    // Sanitize targets with preview helper to protect sensitive passwords
    const sanitized = rows.map((m) => {
      let previewTarget = m.target;
      try {
        const decrypted = decryptMonitorTarget(m.target);
        previewTarget = getMonitorTargetPreview(decrypted, m.type);
      } catch {
        previewTarget = '[Encrypted Target]';
      }

      return {
        id: m.id,
        userId: m.user_id,
        userName: m.user_name,
        userEmail: m.user_email,
        name: m.name,
        type: m.type,
        targetPreview: previewTarget,
        checkInterval: m.check_interval,
        keyword: m.keyword,
        status: m.status,
        lastLatencyMs: m.last_latency_ms,
        lastCheckedAt: m.last_checked_at,
        createdAt: m.created_at,
      };
    });

    return res.status(200).json({
      monitors: sanitized,
      totalCount: sanitized.length,
    });
  } catch (err) {
    console.error('❌ [Admin Monitors] Failed to list monitors:', err.message);
    return res.status(500).json({ message: 'Failed to retrieve platform monitors.' });
  }
};

/**
 * Updates a user's role (e.g. promoting 'developer' to 'admin' or vice-versa).
 */
export const updateUserRole = async (req, res) => {
  const targetUserId = Number(req.params.id);
  const { role } = req.body ?? {};

  if (!targetUserId || !['developer', 'admin'].includes(role)) {
    return res.status(400).json({ message: "Invalid user ID or role. Allowed: 'developer', 'admin'." });
  }

  try {
    // Prevent self-demotion if you are an admin
    if (req.user.id === targetUserId && role !== 'admin') {
      return res.status(400).json({ message: 'You cannot revoke your own administrator privileges.' });
    }

    const { rows } = await query(
      `UPDATE users 
       SET role = $1 
       WHERE id = $2 
       RETURNING id, name, email, role, created_at;`,
      [role, targetUserId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.status(200).json({
      message: `User role successfully updated to ${role}.`,
      user: rows[0],
    });
  } catch (err) {
    console.error('❌ [Admin Update Role] Error:', err.message);
    return res.status(500).json({ message: 'Failed to update user role.' });
  }
};
