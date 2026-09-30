import { query } from '../config/db.js';
import { proberHttp } from '../service/prober.js';
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

    return res.status(201).json({
      monitor: rows[0],
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
      `
        SELECT * FROM monitors 
        WHERE user_id = $1 
        ORDER BY created_at DESC;
    `,
      [userId],
    );
    return res.status(200).json({ monitors: rows });
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
    if (monitor.type !== 'http') {
      return res
        .status(400)
        .json({
          message: 'On-demand testing currently supports HTTP monitors only.',
        });
    }

    const result = await proberHttp(monitor.target, monitor.keyword);
    const { finalStatus, shouldAlert } = await recordProbeResult(
      monitor,
      result,
    );
    const persistedStatus =
      finalStatus === 'pending_down' ? 'pending' : finalStatus;

    const { rows: updatedRows } = await query(
      `UPDATE monitors
       SET status = $1, last_latency_ms = $2, last_checked_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *;`,
      [persistedStatus, result.latency, id, userId],
    );
    if (updatedRows.length === 0) {
      return res.status(404).json({ message: 'Monitor not found.' });
    }

    return res.status(200).json({
      monitor: updatedRows[0],
      finalStatus,
      shouldAlert,
      error: result.error,
    });
  } catch (error) {
    console.error('Monitor test failed:', error.message);
    return res.status(500).json({ message: 'Unable to test monitor.' });
  }
};
