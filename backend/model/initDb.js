import { query } from '../config/db.js';

export const initDb = async () => {
  const createUsersTableSQL = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) DEFAULT 'developer',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createMonitorsTableSQL = `
    CREATE TABLE IF NOT EXISTS monitors (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(120) NOT NULL,
      type VARCHAR(30) NOT NULL, -- 'http', 'postgres', 'mysql', 'redis', 'cron'
      target TEXT NOT NULL,       -- URL or connection string
      check_interval INTEGER NOT NULL DEFAULT 30, -- In seconds (e.g. 30, 60, 300)
      keyword VARCHAR(100),       -- Optional keyword assertion for HTTP
      status VARCHAR(20) DEFAULT 'pending', -- 'up', 'down', 'pending'
      last_latency_ms INTEGER DEFAULT NULL,
      last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  try {
    await query(createUsersTableSQL);
    await query(createMonitorsTableSQL);
    await query(
      'UPDATE monitors SET check_interval = 30 WHERE check_interval IS NULL;',
    );
    await query(
      'ALTER TABLE monitors ALTER COLUMN check_interval SET DEFAULT 30;',
    );
    await query(
      'ALTER TABLE monitors ALTER COLUMN check_interval SET NOT NULL;',
    );
    await query(`
      WITH ranked_monitors AS (
        SELECT id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, lower(btrim(name)), type, btrim(target),
              check_interval, COALESCE(NULLIF(btrim(keyword), ''), '')
            ORDER BY created_at ASC NULLS LAST, id ASC
          ) AS duplicate_rank
        FROM monitors
      )
      DELETE FROM monitors
      USING ranked_monitors
      WHERE monitors.id = ranked_monitors.id
        AND ranked_monitors.duplicate_rank > 1;
    `);
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS monitors_unique_user_configuration_idx
      ON monitors (
        user_id,
        lower(btrim(name)),
        type,
        btrim(target),
        check_interval,
        COALESCE(NULLIF(btrim(keyword), ''), '')
      );
    `);
    console.log(
      '✅ PostgreSQL: tables and monitor uniqueness verified successfully.',
    );
  } catch (err) {
    console.error('❌ Failed to initialize database table:', err.message);
  }
};
