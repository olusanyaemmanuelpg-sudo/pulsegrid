import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const validateRuntimeConfig = () => {
  const requiredInProduction = [
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_SECRET',
    'MONITOR_TARGET_ENCRYPTION_KEY',
  ];
  const missing = requiredInProduction.filter(
    (key) => !process.env[key] || String(process.env[key]).trim() === '',
  );

  const invalidJwtSecret =
    process.env.JWT_SECRET && String(process.env.JWT_SECRET).trim().length < 32;

  const invalidMonitorTargetKey =
    process.env.MONITOR_TARGET_ENCRYPTION_KEY &&
    !/^[a-f0-9]{64}$/i.test(process.env.MONITOR_TARGET_ENCRYPTION_KEY);

  if (process.env.NODE_ENV === 'production') {
    if (missing.length > 0) {
      throw new Error(
        `Production startup failed: missing required environment variables: ${missing.join(', ')}`,
      );
    }

    if (invalidJwtSecret) {
      throw new Error(
        'Production startup failed: JWT_SECRET must be at least 32 characters long.',
      );
    }

    if (invalidMonitorTargetKey) {
      throw new Error(
        'Production startup failed: MONITOR_TARGET_ENCRYPTION_KEY must be a 64-character hex key.',
      );
    }
  }
};

const isProduction = process.env.NODE_ENV === 'production';
const isLocalOrDockerDb =
  process.env.DATABASE_URL?.includes('@primary:') ||
  process.env.DATABASE_URL?.includes('@replica:') ||
  process.env.DATABASE_URL?.includes('@localhost:') ||
  process.env.DATABASE_URL?.includes('@127.0.0.1:');

const sslConfig =
  process.env.DB_SSL === 'true' ||
  (isProduction && process.env.DB_SSL !== 'false' && !isLocalOrDockerDb)
    ? { rejectUnauthorized: false }
    : false;

export const getReplicaConfig = () => {
  const primaryConnectionString = process.env.DATABASE_URL || '';
  const readConnectionString = (process.env.DATABASE_READ_URL || '').trim();

  if (
    !readConnectionString ||
    readConnectionString === primaryConnectionString
  ) {
    return {
      enabled: false,
      readConnectionString: primaryConnectionString,
      mode: 'primary-only',
    };
  }

  return {
    enabled: true,
    readConnectionString,
    mode: 'replica',
  };
};

const replicaConfig = getReplicaConfig();

// 1. PRIMARY WRITE POOL (Master Database)
// Handles all INSERT, UPDATE, DELETE, and DDL operations
export const writePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  max: Number(process.env.DB_WRITE_POOL_SIZE || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

writePool.on('error', (err) => {
  console.error(
    '❌ [PostgreSQL Primary Pool] Unexpected error on idle client:',
    err.message,
  );
});

// 2. READ REPLICA POOL (Follower / Read-Only Replica)
// If DATABASE_READ_URL is not set, the app intentionally uses the primary for reads.
export const isUsingDedicatedReplica = replicaConfig.enabled;

export const readPool = new Pool({
  connectionString:
    replicaConfig.readConnectionString || process.env.DATABASE_URL,
  ssl: sslConfig,
  max: Number(process.env.DB_READ_POOL_SIZE || 20),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

readPool.on('error', (err) => {
  console.warn(
    '⚠️ [PostgreSQL Read Replica Pool] Unexpected error on idle client:',
    err.message,
  );
});

/**
 * Execute a write query on the Primary Master database.
 */
export const writeQuery = (text, params) => writePool.query(text, params);

/**
 * Execute a read query on the Read Replica when a dedicated replica is configured.
 * If no replica is configured, reads fall back to the primary to keep the app safe and predictable.
 */
export const readQuery = async (text, params) => {
  if (!isUsingDedicatedReplica) {
    return await writePool.query(text, params);
  }

  try {
    return await readPool.query(text, params);
  } catch (err) {
    console.warn(
      `⚠️ [DB Read Replica] Read failed (${err.message}). Failing over to Primary Master...`,
    );
    return await writePool.query(text, params);
  }
};

/**
 * Gracefully drains and closes both connection pools.
 */
export const closePools = async () => {
  try {
    await Promise.allSettled([writePool.end(), readPool.end()]);
    console.log('🔒 [PostgreSQL] Database connection pools closed cleanly.');
  } catch (err) {
    console.error('⚠️ [PostgreSQL] Error closing pools:', err.message);
  }
};

// Backward-compatible aliases so existing code continues to work seamlessly:
export const pool = writePool;
export const query = writeQuery;
