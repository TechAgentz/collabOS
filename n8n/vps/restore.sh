#!/usr/bin/env bash
# Restore the n8n stack from a backup.sh tarball onto a running deployment.
#
#   bash /opt/n8n/restore.sh /opt/n8n/backups/n8n-20260905-030000.tar.gz
#
# DESTRUCTIVE: drops and rewrites the n8n database and replaces /home/node/.n8n.
# Requires confirmation. Verify N8N_ENCRYPTION_KEY in the current .env matches
# the `env` file inside the tarball, or every restored credential is unreadable.
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/n8n}
ARCHIVE=${1:-}

[ -n "$ARCHIVE" ] || { echo "usage: bash restore.sh <backup.tar.gz>" >&2; exit 1; }
[ -f "$ARCHIVE" ] || { echo "no such file: $ARCHIVE" >&2; exit 1; }

cd "$APP_DIR"
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
chmod 700 "$STAGE"

echo "==> Unpacking $ARCHIVE"
tar xzf "$ARCHIVE" -C "$STAGE"

BACKUP_KEY=$(grep -E '^N8N_ENCRYPTION_KEY=' "$STAGE/env" | cut -d= -f2- || true)
CURRENT_KEY=$(grep -E '^N8N_ENCRYPTION_KEY=' .env 2>/dev/null | cut -d= -f2- || true)
if [ "$BACKUP_KEY" != "$CURRENT_KEY" ]; then
  echo
  echo "!! N8N_ENCRYPTION_KEY in .env does NOT match the one in this backup."
  echo "!! Restoring anyway leaves every stored credential undecryptable."
  echo "!! Fix: copy the key out of the backup's 'env' file into .env first."
  echo
fi

read -rp "This will ERASE the current n8n database and data volume. Type 'restore' to continue: " ans
[ "$ans" = "restore" ] || { echo "Aborted."; exit 1; }

echo "==> Stopping n8n, ensuring db is up for the import"
docker compose stop n8n
docker compose up -d db
# Wait for the healthcheck rather than racing psql against a cold Postgres.
for _ in $(seq 30); do
  docker compose exec -T db pg_isready -U n8n -d n8n >/dev/null 2>&1 && break
  sleep 2
done

echo "==> Restoring Postgres"
docker compose exec -T db psql -U n8n -d n8n -v ON_ERROR_STOP=1 < "$STAGE/db.sql"

echo "==> Restoring /home/node/.n8n"
docker run --rm \
  --volumes-from "$(docker compose ps -aq n8n)" \
  -v "$STAGE:/backup" \
  alpine:3 sh -c 'rm -rf /home/node/.n8n/* /home/node/.n8n/.[!.]* 2>/dev/null; tar xzf /backup/n8n_data.tar.gz -C /home/node'

echo "==> Starting n8n"
docker compose up -d
docker compose ps

echo "==> Done. Tail the logs and confirm a credential still opens:"
echo "    docker compose logs -f n8n"
