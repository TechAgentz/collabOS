#!/usr/bin/env bash
# Prepare a fresh Ubuntu/Debian VPS to run the CollabOS n8n stack.
# Installs Docker, caps container logs, opens 80/443, and creates /opt/n8n.
#
#   sudo bash bootstrap-vps.sh
#
# Safe to re-run. It does NOT touch sshd_config — see README "Lock down SSH"
# for that, done by hand so a mistake cannot lock you out of the box.
set -euo pipefail

APP_DIR=/opt/n8n

log()  { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33m !  %s\033[0m\n' "$*"; }

[ "$(id -u)" -eq 0 ] || { echo "Run as root: sudo bash $0" >&2; exit 1; }
command -v apt-get >/dev/null || { echo "This script targets Debian/Ubuntu." >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive

log "Updating base system"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq ca-certificates curl gnupg ufw unattended-upgrades

# ── Swap ─────────────────────────────────────────────────────────────────────
# n8n + Postgres + Caddy is comfortable in 2 GB. On a 1 GB droplet the Node
# process gets OOM-killed mid-execution without swap.
if [ "$(free -m | awk '/^Mem:/{print $2}')" -lt 2048 ] && [ ! -f /swapfile ]; then
  log "Creating 2G swapfile (RAM under 2 GB)"
  fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
  chmod 600 /swapfile
  mkswap /swapfile >/dev/null
  swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  sysctl -qw vm.swappiness=10
  grep -q '^vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=10' >> /etc/sysctl.conf
else
  log "Swap: nothing to do"
fi

# ── Docker ───────────────────────────────────────────────────────────────────
if command -v docker >/dev/null 2>&1; then
  log "Docker already installed ($(docker --version))"
else
  log "Installing Docker Engine + compose plugin from Docker's own repo"
  install -m 0755 -d /etc/apt/keyrings
  . /etc/os-release
  curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] \
https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io \
                         docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

# ── Container log rotation ───────────────────────────────────────────────────
# Without this, n8n's stdout grows until it fills the disk and every service
# on the box starts failing at once. This is the single most common way a
# small self-hosted VPS dies.
if [ ! -f /etc/docker/daemon.json ]; then
  log "Capping container logs at 3x10MB"
  mkdir -p /etc/docker
  cat > /etc/docker/daemon.json <<'DAEMONJSON'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "10m", "max-file": "3" }
}
DAEMONJSON
  systemctl restart docker
else
  warn "/etc/docker/daemon.json exists — left alone. Confirm it sets log-opts max-size."
fi

# ── Firewall ─────────────────────────────────────────────────────────────────
# SSH is allowed first, deliberately, before the deny-by-default rule is armed.
log "Configuring ufw (SSH + HTTP + HTTPS)"
ufw allow OpenSSH        >/dev/null
ufw allow 80/tcp         >/dev/null
ufw allow 443/tcp        >/dev/null
ufw allow 443/udp        >/dev/null   # HTTP/3
ufw default deny incoming  >/dev/null
ufw default allow outgoing >/dev/null
ufw --force enable
ufw status verbose

# Note: Docker publishes ports by writing its own iptables DOCKER chain, which
# bypasses ufw. That is fine here — the only published ports in the compose
# file are caddy's 80/443. Postgres and n8n are never published, so they stay
# unreachable from the internet regardless of ufw.

# ── Automatic security updates ───────────────────────────────────────────────
log "Enabling unattended security upgrades"
dpkg-reconfigure -f noninteractive unattended-upgrades

# ── fail2ban (SSH brute-force) ───────────────────────────────────────────────
log "Installing fail2ban for sshd"
apt-get install -y -qq fail2ban
cat > /etc/fail2ban/jail.d/sshd.local <<'JAILEOF'
[sshd]
enabled  = true
backend  = systemd
maxretry = 5
findtime = 10m
bantime  = 1h
JAILEOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# ── App directory ────────────────────────────────────────────────────────────
log "Preparing ${APP_DIR}"
mkdir -p "${APP_DIR}" "${APP_DIR}/backups"
chmod 750 "${APP_DIR}" "${APP_DIR}/backups"

log "Done."
cat <<'NEXTEOF'

Next steps
----------
 1. Copy this vps/ directory to /opt/n8n on the server, e.g. from your laptop:
        scp -r n8n/vps/* root@<SERVER_IP>:/opt/n8n/

 2. Point DNS at this server and WAIT for it to resolve:
        A   n8n.yourdomain.com  ->  <SERVER_IP>
        dig +short n8n.yourdomain.com        # must return <SERVER_IP>

 3. cd /opt/n8n
    cp .env.example .env && chmod 600 .env
    openssl rand -hex 32     # -> POSTGRES_PASSWORD
    openssl rand -hex 32     # -> N8N_ENCRYPTION_KEY
    nano .env                # fill in N8N_DOMAIN and ACME_EMAIL too

 4. docker compose up -d && docker compose logs -f caddy
    Watch for "certificate obtained successfully", then open
    https://n8n.yourdomain.com and create the owner account immediately.

 5. bash install-backup-cron.sh      # nightly encrypted-key + DB backups

NEXTEOF
