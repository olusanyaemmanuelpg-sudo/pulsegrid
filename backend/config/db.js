import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
// Connection pool handles reusing connections efficiently
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // In production, SSL is usually required (e.g., Neon/Supabase/Railway)
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});
// Helper function to run queries
export const query = (text, params) => pool.query(text, params);
