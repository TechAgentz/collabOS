#!/usr/bin/env bash
# Nightly backup of the whole n8n stack.
#
#   bash /opt/n8n/backup.sh
#
# Produces /opt/n8n/backups/n8n-<timestamp>.tar.gz containing:
#   db.sql            full Postgres dump (workflows, credentials, executions)
#   n8n_data.tar.gz   /home/node/.n8n  (config file, binary data, custom nodes)
#   env               a copy of .env, which holds N8N_ENCRYPTION_KEY
#
# The dump alone is worthless without the encryption key, so all three travel
# together — which also means the tarball is as sensitive as the key itself.
# It is written 0600 and root-owned. Copy it OFF this server (see README).
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/n8n}
BACKUP_DIR=${BACKUP_DIR:-$APP_DIR/backups}
KEEP_DAYS=${KEEP_DAYS:-14}

cd "$APP_DIR"

STAMP=$(date +%Y%m%d-%H%M%S)
STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT
chmod 700 "$STAGE"

N8N_CID=$(docker compose ps -q n8n)
[ -n "$N8N_CID" ] || { echo "n8n container not found - is the stack up? (docker compose ps)" >&2; exit 1; }

echo "==> Dumping Postgres"
docker compose exec -T db pg_dump -U n8n --clean --if-exists n8n > "$STAGE/db.sql"

echo "==> Archiving n8n data volume"
docker run --rm \
  --volumes-from "$N8N_CID" \
  -v "$STAGE:/backup" \
  alpine:3 tar czf /backup/n8n_data.tar.gz -C /home/node .n8n

echo "==> Capturing .env (contains N8N_ENCRYPTION_KEY)"
cp .env "$STAGE/env"

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/n8n-$STAMP.tar.gz"
tar czf "$OUT" -C "$STAGE" db.sql n8n_data.tar.gz env
chmod 600 "$OUT"

echo "==> Pruning backups older than ${KEEP_DAYS} days"
find "$BACKUP_DIR" -name 'n8n-*.tar.gz' -type f -mtime "+$KEEP_DAYS" -print -delete

echo "==> Done: $OUT ($(du -h "$OUT" | cut -f1))"

# A backup that only exists on the machine it is backing up is not a backup.
# Uncomment one of these after configuring the tool:
#   rclone copy "$OUT" remote:n8n-backups/
#   aws s3 cp "$OUT" s3://your-bucket/n8n-backups/
#   scp "$OUT" user@another-host:/srv/backups/n8n/
