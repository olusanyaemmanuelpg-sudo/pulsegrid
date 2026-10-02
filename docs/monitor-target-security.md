# Monitor Target Security

Monitor connection URLs are encrypted in PostgreSQL with AES-256-GCM. The key is
not stored in the database. Set `MONITOR_TARGET_ENCRYPTION_KEY` to a stable,
private 64-character hexadecimal key before starting the backend:

```sh
openssl rand -hex 32
```

Put the output in `backend/.env` or the production secret manager. Back it up
securely. Losing the key makes stored monitor targets permanently unreadable;
rotating it requires decrypting and re-encrypting all monitor targets.

The app migrates existing plaintext targets at startup and does not listen for
API traffic until that migration succeeds. Keep a protected database backup
before deploying this change. API responses contain only redacted target
previews; probe credentials remain on the backend.

## Probe Account Privileges

Create separate credentials for probes. Do not use database owner, superuser,
or Redis administrator accounts.

For PostgreSQL, the probe only executes `SELECT 1`, so it needs database connect
permission but no table access:

```sql
CREATE ROLE pulsegrid_probe LOGIN PASSWORD 'use-a-unique-secret';
GRANT CONNECT ON DATABASE monitored_database TO pulsegrid_probe;
```

For Redis, use TLS and an ACL user that can only authenticate and send `PING`:

```text
ACL SETUSER pulsegrid_probe on >use-a-unique-secret -@all +ping
```

Use `rediss://` targets. The backend rejects plain Redis URLs because they send
credentials without TLS.

## Network Boundaries

Monitor targets must resolve only to public unicast IP addresses. The backend
rejects loopback, private, link-local, reserved, and mixed public/private DNS
answers, and pins each probe to its validated DNS answer. HTTP redirects are not
followed.

Also apply egress firewall rules on the VPS: deny loopback, private network
ranges, link-local/metadata addresses, and internal service ports unless
explicitly required. Allow only the public destination ports your probes need.
Application checks complement firewall rules; they do not replace them.

For local development, provide `POSTGRES_PASSWORD` and `REPLICATION_PASSWORD`
in `docker/.env` using distinct generated values. Do not commit `.env` files.

With existing Docker volumes, changing those Compose variables does not change
the passwords already stored in PostgreSQL. Use `\password postgres` and
`\password replicator` in a `psql` session, then set matching values in
`docker/.env` and `backend/.env`. The init scripts only run automatically for
an empty database volume; do not delete volumes to rotate passwords.
