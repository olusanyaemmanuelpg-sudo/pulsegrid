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

  try {
    await query(createUsersTableSQL);
    console.log('✅ PostgreSQL: users table verified / created successfully.');
  } catch (err) {
    console.error('❌ Failed to initialize database table:', err.message);
  }
};
