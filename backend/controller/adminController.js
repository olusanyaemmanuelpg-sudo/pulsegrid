import { query, readQuery } from '../config/db.js';
import { redis } from '../config/redis.js';
import { getActiveWorkers } from '../service/workerRegistry.js';
import { isUsingDedicatedReplica } from '../config/db.js';
import {
  decryptMonitorTarget,
  getMonitorTargetPreview,
} from '../security/monitorTargetSecurity.js';
import {
  proberHttp,
  probePostgres,
  probeRedis,
} from '../service/prober.js';
import { recordProbeResult } from '../service/healthService.js';

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
        COALESCE(m.is_public, true) AS is_public,
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
        isPublic: m.is_public !== false,
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

/**
 * Triggers an immediate manual probe for any platform monitor by admin.
 */
export const adminTestMonitor = async (req, res) => {
  const monitorId = Number(req.params.id);
  if (!monitorId) {
    return res.status(400).json({ message: 'Invalid monitor ID.' });
  }

  try {
    const { rows } = await query('SELECT * FROM monitors WHERE id = $1', [monitorId]);
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Monitor not found.' });
    }

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
      const gracePeriod = Math.max(60, Math.floor(monitor.check_interval * 0.2));
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

    const { finalStatus } = await recordProbeResult(monitor, result);
    const persistedStatus = finalStatus === 'pending_down' ? 'pending' : finalStatus;

    await query(
      `UPDATE monitors
       SET status = $1, 
           last_latency_ms = $2, 
           last_checked_at = CASE WHEN type = 'cron' THEN last_checked_at ELSE NOW() END
       WHERE id = $3;`,
      [persistedStatus, result.latency, monitorId],
    );

    return res.status(200).json({
      message: 'Probe test completed.',
      status: persistedStatus,
      latency: result.latency,
      error: result.error,
    });
  } catch (error) {
    console.error('❌ [Admin Test Monitor] Error:', error.message);
    return res.status(500).json({ message: 'Unable to test monitor.' });
  }
};

/**
 * Removes any platform monitor by admin.
 */
export const adminDeleteMonitor = async (req, res) => {
  const monitorId = Number(req.params.id);
  if (!monitorId) {
    return res.status(400).json({ message: 'Invalid monitor ID.' });
  }

  try {
    const { rowCount } = await query('DELETE FROM monitors WHERE id = $1', [monitorId]);
    if (rowCount === 0) {
      return res.status(404).json({ message: 'Monitor not found.' });
    }

    await redis.del(`monitor:${monitorId}:checks`).catch(() => {});

    return res.status(200).json({ message: 'Service removed from platform.' });
  } catch (error) {
    console.error('❌ [Admin Delete Monitor] Error:', error.message);
    return res.status(500).json({ message: 'Unable to delete monitor.' });
  }
};

/**
 * Fetches current system status configuration, announcements, and all recorded incidents.
 */
export const getAdminSystemStatus = async (req, res) => {
  try {
    const { rows: statusRows } = await readQuery(
      `SELECT id, mode, announcement_title, announcement_message, announcement_level, is_announcement_active, updated_at
       FROM system_status
       WHERE id = 1
       LIMIT 1;`,
    );

    const { rows: incidentRows } = await readQuery(
      `SELECT id, title, status, severity, impacted_components, message, created_at, updated_at, resolved_at
       FROM system_incidents
       ORDER BY created_at DESC;`,
    );

    const statusConfig = statusRows[0] || {
      id: 1,
      mode: 'auto',
      announcement_title: '',
      announcement_message: '',
      announcement_level: 'info',
      is_announcement_active: false,
    };

    return res.status(200).json({
      statusConfig,
      incidents: incidentRows,
    });
  } catch (err) {
    console.error('❌ [Admin Status] Fetch failed:', err.message);
    return res.status(500).json({ message: 'Failed to retrieve system status settings.' });
  }
};

/**
 * Updates global platform status override mode and announcement banner.
 */
export const updateAdminSystemStatus = async (req, res) => {
  const { mode, announcementTitle, announcementMessage, announcementLevel, isAnnouncementActive } = req.body ?? {};

  const allowedModes = ['auto', 'operational', 'degraded', 'partial_outage', 'major_outage', 'maintenance'];
  if (mode && !allowedModes.includes(mode)) {
    return res.status(400).json({ message: `Invalid status mode. Allowed: ${allowedModes.join(', ')}.` });
  }

  const allowedLevels = ['info', 'warning', 'critical', 'maintenance'];
  if (announcementLevel && !allowedLevels.includes(announcementLevel)) {
    return res.status(400).json({ message: `Invalid announcement level. Allowed: ${allowedLevels.join(', ')}.` });
  }

  try {
    const { rows } = await query(
      `INSERT INTO system_status (
        id, mode, announcement_title, announcement_message, announcement_level, is_announcement_active, updated_by_user_id, updated_at
      ) VALUES (
        1, 
        COALESCE($1, 'auto'), 
        $2, 
        $3, 
        COALESCE($4, 'info'), 
        COALESCE($5, false), 
        $6, 
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        mode = COALESCE(EXCLUDED.mode, system_status.mode),
        announcement_title = EXCLUDED.announcement_title,
        announcement_message = EXCLUDED.announcement_message,
        announcement_level = COALESCE(EXCLUDED.announcement_level, system_status.announcement_level),
        is_announcement_active = COALESCE(EXCLUDED.is_announcement_active, system_status.is_announcement_active),
        updated_by_user_id = EXCLUDED.updated_by_user_id,
        updated_at = NOW()
      RETURNING *;`,
      [
        mode || 'auto',
        announcementTitle ?? null,
        announcementMessage ?? null,
        announcementLevel || 'info',
        Boolean(isAnnouncementActive),
        req.user?.id || null,
      ],
    );

    return res.status(200).json({
      message: 'System status and announcement settings saved successfully.',
      statusConfig: rows[0],
    });
  } catch (err) {
    console.error('❌ [Admin Status] Update failed:', err.message);
    return res.status(500).json({ message: 'Failed to update system status settings.' });
  }
};

/**
 * Creates a new public system incident.
 */
export const createAdminIncident = async (req, res) => {
  const { title, severity, status, impactedComponents, message } = req.body ?? {};

  if (!title || typeof title !== 'string' || !title.trim() || !message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ message: 'Incident title and message are required.' });
  }

  const allowedStatus = ['investigating', 'identified', 'monitoring', 'resolved'];
  const finalStatus = allowedStatus.includes(status) ? status : 'investigating';

  const allowedSeverity = ['minor', 'major', 'critical', 'maintenance'];
  const finalSeverity = allowedSeverity.includes(severity) ? severity : 'minor';

  try {
    const isResolved = finalStatus === 'resolved';
    const { rows } = await query(
      `INSERT INTO system_incidents (
        title, severity, status, impacted_components, message, created_by, resolved_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *;`,
      [
        title.trim(),
        finalSeverity,
        finalStatus,
        impactedComponents ? impactedComponents.trim() : null,
        message.trim(),
        req.user?.id || null,
        isResolved ? new Date() : null,
      ],
    );

    return res.status(201).json({
      message: 'Incident published successfully.',
      incident: rows[0],
    });
  } catch (err) {
    console.error('❌ [Admin Incident] Create failed:', err.message);
    return res.status(500).json({ message: 'Failed to create system incident.' });
  }
};

/**
 * Updates an ongoing or resolved system incident.
 */
export const updateAdminIncident = async (req, res) => {
  const incidentId = Number(req.params.id);
  if (!incidentId) {
    return res.status(400).json({ message: 'Invalid incident ID.' });
  }

  const { title, severity, status, impactedComponents, message } = req.body ?? {};

  const allowedStatus = ['investigating', 'identified', 'monitoring', 'resolved'];
  if (status && !allowedStatus.includes(status)) {
    return res.status(400).json({ message: `Invalid status. Allowed: ${allowedStatus.join(', ')}.` });
  }

  try {
    const currentRes = await query('SELECT * FROM system_incidents WHERE id = $1', [incidentId]);
    if (currentRes.rows.length === 0) {
      return res.status(404).json({ message: 'Incident not found.' });
    }
    const current = currentRes.rows[0];

    const newStatus = status || current.status;
    let resolvedAt = current.resolved_at;
    if (newStatus === 'resolved' && !resolvedAt) {
      resolvedAt = new Date();
    } else if (newStatus !== 'resolved') {
      resolvedAt = null;
    }

    const { rows } = await query(
      `UPDATE system_incidents
       SET title = COALESCE($1, title),
           severity = COALESCE($2, severity),
           status = COALESCE($3, status),
           impacted_components = COALESCE($4, impacted_components),
           message = COALESCE($5, message),
           resolved_at = $6,
           updated_at = NOW()
       WHERE id = $7
       RETURNING *;`,
      [
        title ? title.trim() : null,
        severity || null,
        newStatus,
        impactedComponents !== undefined ? impactedComponents : null,
        message ? message.trim() : null,
        resolvedAt,
        incidentId,
      ],
    );

    return res.status(200).json({
      message: 'Incident updated successfully.',
      incident: rows[0],
    });
  } catch (err) {
    console.error('❌ [Admin Incident] Update failed:', err.message);
    return res.status(500).json({ message: 'Failed to update system incident.' });
  }
};

/**
 * Deletes a system incident.
 */
export const deleteAdminIncident = async (req, res) => {
  const incidentId = Number(req.params.id);
  if (!incidentId) {
    return res.status(400).json({ message: 'Invalid incident ID.' });
  }

  try {
    const { rowCount } = await query('DELETE FROM system_incidents WHERE id = $1', [incidentId]);
    if (rowCount === 0) {
      return res.status(404).json({ message: 'Incident not found.' });
    }
    return res.status(200).json({ message: 'Incident removed successfully.' });
  } catch (err) {
    console.error('❌ [Admin Incident] Delete failed:', err.message);
    return res.status(500).json({ message: 'Failed to delete system incident.' });
  }
};

/**
 * Toggles whether a monitor is showcased on the public system status page.
 */
export const toggleMonitorVisibility = async (req, res) => {
  const monitorId = Number(req.params.id);
  const { isPublic } = req.body ?? {};

  if (!monitorId || typeof isPublic !== 'boolean') {
    return res.status(400).json({ message: 'Monitor ID and boolean isPublic are required.' });
  }

  try {
    const { rows } = await query(
      `UPDATE monitors
       SET is_public = $1
       WHERE id = $2
       RETURNING id, name, is_public;`,
      [isPublic, monitorId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Monitor not found.' });
    }

    return res.status(200).json({
      message: `Monitor visibility updated to ${isPublic ? 'Public' : 'Private'}.`,
      monitor: rows[0],
    });
  } catch (err) {
    console.error('❌ [Admin Monitor Visibility] Update failed:', err.message);
    return res.status(500).json({ message: 'Failed to update monitor visibility.' });
  }
};


