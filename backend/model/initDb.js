import pg from 'pg';
import { query, writePool, sslConfig } from '../config/db.js';
import {
  assertMonitorTargetEncryptionKey,
  decryptMonitorTarget,
  encryptMonitorTarget,
  fingerprintMonitorTarget,
  isEncryptedMonitorTarget,
} from '../security/monitorTargetSecurity.js';
import { getAdminEmails } from '../security/adminEmails.js';

const { Pool } = pg;

export const ensureDatabaseExists = async () => {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl || process.env.NODE_ENV === 'test') return;

  try {
    const parsed = new URL(dbUrl);
    const targetDb = parsed.pathname.replace(/^\//, '');
    if (!targetDb || targetDb === 'postgres') return;

    // Connect to default administrative 'postgres' database
    const adminUrl = new URL(dbUrl);
    adminUrl.pathname = '/postgres';

    const adminPool = new Pool({
      connectionString: adminUrl.toString(),
      ssl: sslConfig,
      connectionTimeoutMillis: 5000,
    });

    let client = null;
    for (let attempt = 1; attempt <= 15; attempt++) {
      try {
        client = await adminPool.connect();
        break;
      } catch (err) {
        if (attempt === 15) throw err;
        console.log(
          `⏳ [ensureDb] Waiting for PostgreSQL administrative connection (attempt ${attempt}/15)...`,
        );
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    try {
      const { rows } = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1;',
        [targetDb],
      );
      if (rows.length === 0) {
        console.log(
          `🔨 [ensureDb] Database "${targetDb}" does not exist. Creating...`,
        );
        await client.query(`CREATE DATABASE "${targetDb.replace(/"/g, '""')}";`);
        console.log(`✅ [ensureDb] Database "${targetDb}" created successfully.`);
      }
    } finally {
      client.release();
      await adminPool.end().catch(() => {});
    }
  } catch (err) {
    console.warn('⚠️ [ensureDb] Database existence check notice:', err.message);
  }
};

const migrateMonitorTargets = async () => {
  assertMonitorTargetEncryptionKey();
  const { rows } = await query(`
    SELECT id, target, target_fingerprint
    FROM monitors
    WHERE target_fingerprint IS NULL OR target NOT LIKE 'enc:v1:%';
  `);

  for (const row of rows) {
    const plaintext = isEncryptedMonitorTarget(row.target)
      ? decryptMonitorTarget(row.target)
      : row.target;
    const encryptedTarget = isEncryptedMonitorTarget(row.target)
      ? row.target
      : encryptMonitorTarget(plaintext);
    const fingerprint = fingerprintMonitorTarget(plaintext);

    await query(
      `UPDATE monitors
       SET target = $1, target_fingerprint = $2
       WHERE id = $3;`,
      [encryptedTarget, fingerprint, row.id],
    );
  }
};

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
      target_fingerprint TEXT,
      check_interval INTEGER NOT NULL DEFAULT 30, -- In seconds (e.g. 30, 60, 300)
      keyword VARCHAR(100),       -- Optional keyword assertion for HTTP
      heartbeat_secret VARCHAR(128),
      status VARCHAR(20) DEFAULT 'pending', -- 'up', 'down', 'pending'
      last_latency_ms INTEGER DEFAULT NULL,
      last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const addHeartbeatSecretColumnSQL = `
    ALTER TABLE monitors
      ADD COLUMN IF NOT EXISTS heartbeat_secret VARCHAR(128);
  `;

  const backfillHeartbeatSecretsSQL = `
    UPDATE monitors
    SET heartbeat_secret = SUBSTRING(MD5(RANDOM()::TEXT || id::TEXT || NOW()::TEXT), 1, 32)
    WHERE heartbeat_secret IS NULL;
  `;

  const createHeartbeatSecretIndexSQL = `
    CREATE UNIQUE INDEX IF NOT EXISTS monitors_heartbeat_secret_idx
    ON monitors (heartbeat_secret)
    WHERE heartbeat_secret IS NOT NULL;
  `;

  const createMonitorChecksTableSQL = `
    CREATE TABLE IF NOT EXISTS monitor_checks (
      id BIGSERIAL PRIMARY KEY,
      monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
      status VARCHAR(20) NOT NULL,
      latency_ms INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor_created
    ON monitor_checks (monitor_id, created_at DESC);
  `;

  const createAlertChannelsTableSQL = `
    CREATE TABLE IF NOT EXISTS alert_channels (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(30) NOT NULL,
      name VARCHAR(100) NOT NULL,
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_alert_channels_user ON alert_channels(user_id);
  `;

  const createSystemStatusTableSQL = `
    CREATE TABLE IF NOT EXISTS system_status (
      id INTEGER PRIMARY KEY DEFAULT 1,
      mode VARCHAR(30) NOT NULL DEFAULT 'auto',
      announcement_title VARCHAR(255),
      announcement_message TEXT,
      announcement_level VARCHAR(30) DEFAULT 'info',
      is_announcement_active BOOLEAN NOT NULL DEFAULT FALSE,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      CONSTRAINT single_system_status CHECK (id = 1)
    );
    INSERT INTO system_status (id, mode, is_announcement_active)
    VALUES (1, 'auto', false)
    ON CONFLICT (id) DO NOTHING;
  `;

  const createSystemIncidentsTableSQL = `
    CREATE TABLE IF NOT EXISTS system_incidents (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'investigating',
      severity VARCHAR(30) NOT NULL DEFAULT 'minor',
      impacted_components TEXT,
      message TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_system_incidents_created ON system_incidents (created_at DESC);
  `;

  await ensureDatabaseExists();

  let client;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      client = await writePool.connect();
      break;
    } catch (err) {
      if (attempt === 15) {
        console.error('❌ Could not connect to PostgreSQL after 15 attempts:', err.message);
        throw err;
      }
      console.log(`⏳ [initDb] Waiting for PostgreSQL database (attempt ${attempt}/15, error: ${err.message}). Retrying in 2s...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }
  const ADVISORY_LOCK_ID = 987654321;

  try {
    assertMonitorTargetEncryptionKey();

    // Acquire PostgreSQL advisory lock to serialize DDL migrations across horizontally scaled nodes
    await client.query('SELECT pg_advisory_lock($1);', [ADVISORY_LOCK_ID]);

    await client.query(createUsersTableSQL);
    await client.query(createMonitorsTableSQL);
    await client.query(createAlertChannelsTableSQL);
    await client.query(createSystemStatusTableSQL);
    await client.query(createSystemIncidentsTableSQL);
    await client.query(
      'ALTER TABLE monitors ADD COLUMN IF NOT EXISTS target_fingerprint TEXT;',
    );
    await client.query(
      'ALTER TABLE monitors ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;',
    );
    await client.query(
      'ALTER TABLE monitors ALTER COLUMN is_public SET DEFAULT FALSE;',
    );
    await client.query(
      'UPDATE monitors SET is_public = FALSE WHERE is_public IS TRUE OR is_public IS NULL;',
    );
    await client.query(addHeartbeatSecretColumnSQL);
    await client.query(backfillHeartbeatSecretsSQL);
    await client.query(createHeartbeatSecretIndexSQL);
    await client.query(createMonitorChecksTableSQL);
    await client.query(
      'UPDATE monitors SET check_interval = 30 WHERE check_interval IS NULL;',
    );
    await client.query(
      'ALTER TABLE monitors ALTER COLUMN check_interval SET DEFAULT 30;',
    );
    await client.query(
      'ALTER TABLE monitors ALTER COLUMN check_interval SET NOT NULL;',
    );
    await client.query(`
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
    await migrateMonitorTargets();
    await client.query(
      'ALTER TABLE monitors ALTER COLUMN target_fingerprint SET NOT NULL;',
    );
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS monitors_unique_user_fingerprint_idx
      ON monitors (
        user_id,
        lower(btrim(name)),
        type,
        target_fingerprint,
        check_interval,
        COALESCE(NULLIF(btrim(keyword), ''), '')
      );
    `);
    await client.query(
      'DROP INDEX IF EXISTS monitors_unique_user_configuration_idx;',
    );

    // Promote administrator emails configured in ADMIN_EMAILS (or default admin accounts)
    const adminEmails = getAdminEmails();

    if (adminEmails.length > 0) {
      await client.query(
        `UPDATE users SET role = 'admin' WHERE lower(btrim(email)) = ANY($1::text[]);`,
        [adminEmails],
      );
    }

    console.log(
      '✅ PostgreSQL: tables, indexes, and administrator roles verified successfully.',
    );
  } catch (err) {
    console.error('❌ Failed to initialize database table:', err.message);
    throw err;
  } finally {
    try {
      await client.query('SELECT pg_advisory_unlock($1);', [ADVISORY_LOCK_ID]);
    } catch {
      // Ignored if connection closed
    }
    client.release();
  }
};
