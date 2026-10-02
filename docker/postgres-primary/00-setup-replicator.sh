set -e

psql \
  --set=ON_ERROR_STOP=1 \
  --set=replication_password="$REPLICATION_PASSWORD" \
  --username "$POSTGRES_USER" \
  --dbname postgres <<'SQL'
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD :'replication_password';
SQL