set -e

psql \
  --set=ON_ERROR_STOP=1 \
  --set=replication_password="$REPLICATION_PASSWORD" \
  --username "$POSTGRES_USER" \
  --dbname postgres <<'SQL'
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD :'replication_password';
SQL

# Automatically allow streaming replication from replica container
echo "host replication replicator all scram-sha-256" >> "$PGDATA/pg_hba.conf"
echo "host all all all scram-sha-256" >> "$PGDATA/pg_hba.conf"