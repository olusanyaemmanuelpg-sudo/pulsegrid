import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === 'production';
const sslConfig = isProduction ? { rejectUnauthorized: false } : false;

// 1. PRIMARY WRITE POOL (Master Database)
// Handles all INSERT, UPDATE, DELETE, and DDL operations
export const writePool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  max: Number(process.env.DB_WRITE_POOL_SIZE || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// 2. READ REPLICA POOL (Follower / Read-Only Replica)
// If DATABASE_READ_URL is not set, gracefully falls back to DATABASE_URL
const readConnectionString =
  process.env.DATABASE_READ_URL || process.env.DATABASE_URL;

export const isUsingDedicatedReplica = Boolean(
  process.env.DATABASE_READ_URL &&
  process.env.DATABASE_READ_URL !== process.env.DATABASE_URL,
);

export const readPool = new Pool({
  connectionString: readConnectionString,
  ssl: sslConfig,
  max: Number(process.env.DB_READ_POOL_SIZE || 20),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Execute a write query on the Primary Master database.
 */
export const writeQuery = (text, params) => writePool.query(text, params);

/**
 * Execute a read query on the Read Replica.
 * Resilient fallback: If the read replica fails or is temporarily unreachable,
 * it automatically fails over to the write pool so users never see a 500.
 */
export const readQuery = async (text, params) => {
  try {
    return await readPool.query(text, params);
  } catch (err) {
    if (isUsingDedicatedReplica) {
      console.warn(
        `⚠️ [DB Read Replica] Read failed (${err.message}). Failing over to Primary Master...`,
      );
      return await writePool.query(text, params);
    }
    throw err;
  }
};

// Backward-compatible aliases so existing code continues to work seamlessly:
export const pool = writePool;
export const query = writeQuery;
