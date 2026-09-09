#!/usr/bin/env bash
# Schedule backup.sh nightly at 03:17 (off the hour, so it does not collide
# with every other cron job on the internet) and log the result.
#
#   sudo bash install-backup-cron.sh
set -euo pipefail

APP_DIR=${APP_DIR:-/opt/n8n}
[ "$(id -u)" -eq 0 ] || { echo "Run as root: sudo bash $0" >&2; exit 1; }

chmod +x "$APP_DIR/backup.sh"

cat > /etc/cron.d/n8n-backup <<CRONEOF
# CollabOS n8n nightly backup
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
17 3 * * * root cd $APP_DIR && /usr/bin/env bash $APP_DIR/backup.sh >> /var/log/n8n-backup.log 2>&1
CRONEOF
chmod 0644 /etc/cron.d/n8n-backup

cat > /etc/logrotate.d/n8n-backup <<'LOGEOF'
/var/log/n8n-backup.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
}
LOGEOF

echo "Installed /etc/cron.d/n8n-backup (nightly 03:17)."
echo "Test it now:  bash $APP_DIR/backup.sh"
