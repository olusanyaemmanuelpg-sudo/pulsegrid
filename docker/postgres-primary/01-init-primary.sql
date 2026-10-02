ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET max_wal_senders = '10';
ALTER SYSTEM SET max_replication_slots = '10';
ALTER SYSTEM SET wal_keep_size = '1GB';
ALTER SYSTEM SET hot_standby = 'on';

CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replica_password';

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'developer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monitors (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  type VARCHAR(30) NOT NULL,
  target TEXT NOT NULL,
  check_interval INTEGER NOT NULL DEFAULT 30,
  keyword VARCHAR(100),
  heartbeat_secret VARCHAR(128),
  status VARCHAR(20) DEFAULT 'pending',
  last_latency_ms INTEGER DEFAULT NULL,
  last_checked_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS monitor_checks (
  id BIGSERIAL PRIMARY KEY,
  monitor_id INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS monitors_unique_user_configuration_idx
ON monitors (
  user_id,
  lower(btrim(name)),
  type,
  btrim(target),
  check_interval,
  COALESCE(NULLIF(btrim(keyword), ''), '')
);

CREATE INDEX IF NOT EXISTS idx_monitor_checks_monitor_created
ON monitor_checks (monitor_id, created_at DESC);
