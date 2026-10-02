#!/usr/bin/env bash
set -Eeuo pipefail

PGDATA="${PGDATA:-/var/lib/postgresql/data}"
export PGPASSWORD="${REPLICATION_PASSWORD:?REPLICATION_PASSWORD must be set}"

until pg_isready -h primary -p 5432 -U replicator -d postgres; do
  echo "Waiting for primary to accept connections..."
  sleep 2
done

mkdir -p "$PGDATA"
if [[ ! -s "$PGDATA/PG_VERSION" ]]; then
  if [[ -n "$(find "$PGDATA" -mindepth 1 -maxdepth 1 -print -quit)" ]]; then
    echo "Replica data directory is not empty and has no PG_VERSION; refusing to overwrite it." >&2
    exit 1
  fi

  chown postgres:postgres "$PGDATA"
  gosu postgres pg_basebackup -h primary -D "$PGDATA" -U replicator -X stream -C -S replica_1 -R
elif [[ ! -f "$PGDATA/standby.signal" ]]; then
  echo "Existing database in $PGDATA is not a standby; refusing to overwrite it." >&2
  exit 1
fi

printf 'primary:5432:replication:replicator:%s\n' "$REPLICATION_PASSWORD" > "$PGDATA/.pgpass"
chown postgres:postgres "$PGDATA/.pgpass"
chmod 600 "$PGDATA/.pgpass"
sed -i '/^primary_conninfo =/d' "$PGDATA/postgresql.auto.conf"
printf "primary_conninfo = 'host=primary port=5432 user=replicator passfile=%s/.pgpass application_name=pulsegrid-replica'\n" "$PGDATA" >> "$PGDATA/postgresql.auto.conf"

exec /usr/local/bin/docker-entrypoint.sh "$@"
