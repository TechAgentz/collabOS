# n8n on a VPS — CollabOS production runbook

Self-hosted n8n (free Community edition) on a single Ubuntu box, behind Caddy
with automatic HTTPS. This is the deployment that receives real Gmail /
Instagram / WhatsApp webhooks and forwards each message to `/api/ingest`.

> The `n8n/` directory one level up is the **laptop** stack (plain HTTP on
> `localhost:5678`). Keep using it for building workflows; use this one to run
> them. Same `docker compose` verbs, different `.env`, different volumes.

```
Gmail / Instagram / WhatsApp
            |  HTTPS webhook
            v
   +------------------------------+
   |  VPS                         |
   |   caddy  :80 :443  <- public |   auto Let's Encrypt cert
   |     |  http://n8n:5678       |
   |   n8n    (no published port) |   workflows + credentials
   |     |                        |
   |   postgres (internal net)    |   no route to the internet
   +------------------------------+
            |  POST /api/ingest  +  x-webhook-secret
            v
      CollabOS Next.js app  ->  OpenAI  ->  Supabase
```

## Files

| File | Purpose |
| --- | --- |
| `bootstrap-vps.sh` | One-shot prep of a fresh Ubuntu box: Docker, swap, ufw, log rotation, fail2ban |
| `docker-compose.yml` | The stack: caddy + n8n + postgres |
| `Caddyfile` | TLS termination and reverse proxy |
| `.env.example` | Every value you must fill in |
| `backup.sh` | DB dump + data volume + encryption key into one tarball |
| `install-backup-cron.sh` | Schedules `backup.sh` nightly |
| `restore.sh` | Restores a tarball onto a running stack |

---

## 0. Before you start

**VPS** — Ubuntu 22.04 or 24.04, x86_64. 2 GB RAM is the practical minimum
(the bootstrap script adds a 2 GB swapfile below that); 4 GB is comfortable.
20 GB disk. Hetzner CX22, DigitalOcean 2 GB, Contabo VPS S all fit.

**Domain** — you need one, not just an IP. Let's Encrypt will not issue a
certificate for a bare IP, and Meta and Google both refuse to send webhooks to
a non-HTTPS endpoint. A subdomain of a domain you already own is enough.

**Ports 80 and 443 must be reachable.** Some providers put a cloud firewall in
front of the box that `ufw` knows nothing about — check the provider console
too.

---

## 1. Prepare the server

Copy this directory up from your laptop, then run the bootstrap as root:

```bash
scp -r n8n/vps/* root@SERVER_IP:/opt/n8n/
```

```bash
ssh root@SERVER_IP "cd /opt/n8n && bash bootstrap-vps.sh"
```

It installs Docker, caps container logs at 3x10 MB, allows SSH/80/443 in `ufw`,
turns on unattended security upgrades and fail2ban, and creates `/opt/n8n`.
Re-running it is safe.

## 2. Point DNS at the server

Create one **A record**:

```
Type  Name              Value
A     n8n               <SERVER_IP>
```

Then wait, and verify — do not skip this. Caddy gets five certificate failures
per hour from Let's Encrypt before it is rate-limited for that hostname:

```bash
dig +short n8n.yourdomain.com
```

That must print exactly your server IP. If you use Cloudflare, set the record
to **DNS only** (grey cloud) for the first issuance — orange-cloud proxying
breaks the HTTP-01 challenge.

## 3. Configure

```bash
cd /opt/n8n && cp .env.example .env && chmod 600 .env
```

```bash
openssl rand -hex 32 && openssl rand -hex 32
```

Put the first into `POSTGRES_PASSWORD`, the second into `N8N_ENCRYPTION_KEY`,
and set `N8N_DOMAIN`, `ACME_EMAIL` and `GENERIC_TIMEZONE`:

```bash
nano /opt/n8n/.env
```

**Copy `N8N_ENCRYPTION_KEY` into your password manager right now.** n8n encrypts
every stored credential with it. A database backup restored without this exact
key gives you your workflows back with every Gmail token and API secret
permanently unreadable. It is the one value in this stack that cannot be
regenerated.

## 4. Launch

```bash
cd /opt/n8n && docker compose up -d && docker compose logs -f caddy
```

Wait for `certificate obtained successfully`, then open
`https://n8n.yourdomain.com`.

**Create the owner account immediately.** Until you do, the setup page is open
to anyone who finds the hostname. Bots scan for fresh n8n instances; that
window should be seconds, not hours.

```bash
docker compose ps
```

All three services `Up`, `db` healthy.

## 5. Pin the version

`latest` was fine for the first boot. Now make updates deliberate:

```bash
docker compose exec n8n n8n --version
```

Put that number in `N8N_IMAGE_TAG` in `.env`, then `docker compose up -d`.

## 6. Schedule backups

```bash
sudo bash /opt/n8n/install-backup-cron.sh && bash /opt/n8n/backup.sh && ls -lh /opt/n8n/backups/
```

Nightly at 03:17, kept 14 days, logged to `/var/log/n8n-backup.log`.

A backup sitting on the machine it backs up is not a backup. Uncomment one of
the `rclone` / `aws s3` / `scp` lines at the bottom of `backup.sh` to ship the
tarball off-box. The tarball contains `.env`, so it is exactly as sensitive as
the encryption key — send it somewhere private.

To restore:

```bash
bash /opt/n8n/restore.sh /opt/n8n/backups/n8n-20260905-031700.tar.gz
```

---

## 7. Wire n8n to CollabOS

### The shared secret, as a credential

In n8n: **Credentials → New → Header Auth**

- Name: `CollabOS ingest`
- Header name: `x-webhook-secret`
- Header value: the same string as `N8N_WEBHOOK_SECRET` in the app's environment

Attach that credential to the HTTP Request node rather than typing the secret
into a header field — node parameters show up in execution logs, credential
values do not.

### The HTTP Request node

Every channel workflow ends in one:

- **Method** `POST`
- **URL** `https://collab-os-geoy.vercel.app/api/ingest` (the same-VPS alternative is below)
- **Authentication** Generic → Header Auth → `CollabOS ingest`
- **Body** JSON:

```json
{
  "user_id": "<your CollabOS user uuid>",
  "channel": "gmail",
  "raw_text": "={{ $json.text }}",
  "sender": "={{ $json.from }}",
  "external_thread_id": "={{ $json.threadId }}",
  "external_message_id": "={{ $json.messageId }}"
}
```

`external_message_id` is what makes retries safe. `/api/ingest` short-circuits
on a message id it has already seen, so an n8n retry costs nothing instead of
creating a duplicate deal and a second OpenAI call. Always send it.

Turn on the node's **Retry On Fail** (3 tries): the route answers `502`/`503`
for transient AI and database failures specifically so a retry can succeed.

### Vercel or same-VPS?

**App on Vercel** (where CollabOS is deployed) — the production URL is
`https://collab-os-geoy.vercel.app/api/ingest`. Verified 2026-09-05: the route
answers, Deployment Protection is not shielding it, and Vercel's
`N8N_WEBHOOK_SECRET` matches the value in `.env.local`. Nothing else to
configure. The project lives under the `shahinmohamed411` Vercel account, not
the Maxcient team — look there in the dashboard.

**App on this same VPS** — add a second site block to the `Caddyfile` and add
the Next.js app as a service on the `edge` network, then
`docker compose restart caddy`:

```
app.yourdomain.com {
	encode zstd gzip
	reverse_proxy collabos:3000
}
```

In that case n8n can also reach it directly at `http://collabos:3000/api/ingest`,
skipping the public round-trip entirely.

> `host.docker.internal:3000` from the laptop compose file does **not** work
> here. That address only means something on Docker Desktop.

### Note on `$env` in workflows

`N8N_BLOCK_ENV_ACCESS_IN_NODE` is `true`, so `{{ $env.ANYTHING }}` returns
nothing in Code and expression fields. That is deliberate: the container's
environment holds `N8N_ENCRYPTION_KEY` and the Postgres password, and without
this flag any Code node could print them. Put the ingest URL directly in the
node and the secret in a credential. If you want `$env` anyway, flip it in
`docker-compose.yml` and understand you are trading that protection away.

## 8. Register the provider webhooks

Your n8n webhook URLs are now public and HTTPS:

```
Production:  https://n8n.yourdomain.com/webhook/<path>
Test:        https://n8n.yourdomain.com/webhook-test/<path>
```

- **Meta (Instagram / WhatsApp)** — App Dashboard → Webhooks → Callback URL is
  the *production* URL. Meta calls it once with `hub.challenge` before saving,
  so activate the workflow first or verification fails.
- **Gmail** — a Pub/Sub push subscription pointing at the production URL, or
  the polling Gmail Trigger node if you would rather not set up Pub/Sub.

The test URL only listens while "Listen for test event" is open in the editor.
Registering it with a provider gives you a webhook that works once and then
silently stops.

---

## Day-2 operations

Run these from `/opt/n8n`:

```bash
docker compose logs -f n8n
```

```bash
docker compose ps && df -h && free -m
```

```bash
docker compose pull && docker compose up -d
```

```bash
docker system prune -af
```

`docker compose restart n8n` after an `.env` change; `docker compose down`
stops everything without touching the volumes.

**Always back up before an update.** `bash backup.sh` takes seconds and n8n
migrations are one-way — a downgrade after a schema migration will not boot.

### Lock down SSH (do this by hand)

Deliberately not automated: a mistake here locks you out of your own server.
Confirm key-based login works in a *second* terminal that you keep open, set
`PasswordAuthentication no` and `PermitRootLogin prohibit-password` in
`/etc/ssh/sshd_config`, run `sudo systemctl restart ssh`, then verify from a
third terminal before closing the one you have open.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| Caddy loops on "obtaining certificate" | DNS not propagated, or 80/443 blocked | `dig +short n8n.yourdomain.com`; check the provider's cloud firewall as well as `ufw status` |
| `too many failed authorizations` | Burned the Let's Encrypt rate limit | Uncomment `acme_ca` staging in the `Caddyfile`, fix the real problem, comment it back |
| Editor loads but shows "Connection lost" | Push connection not proxied | Confirm `flush_interval -1` in the `Caddyfile` and `N8N_PROXY_HOPS=1` |
| Webhook URLs show `localhost:5678` | `WEBHOOK_URL` / `N8N_HOST` wrong | Fix `N8N_DOMAIN` in `.env`, then `docker compose up -d` |
| Every credential broken after a restore | Wrong `N8N_ENCRYPTION_KEY` | Restore the key from the backup's `env` file — there is no other recovery |
| `/api/ingest` returns 401 | Header mismatch | The Header Auth value must equal the app's `N8N_WEBHOOK_SECRET` exactly, with no trailing newline |
| Deals duplicated on retry | `external_message_id` not sent | Add it to the HTTP Request body |
| n8n killed mid-execution | Out of memory | `free -m`; the bootstrap swapfile covers 1 GB boxes, otherwise size up |
| Disk full | Container logs or old executions | `docker system prune -af`; lower `EXECUTIONS_DATA_MAX_AGE` |

### When to scale past this

One box handles a single creator's inbound volume comfortably. If executions
start queueing, switch n8n to queue mode: add a `redis` service, set
`EXECUTIONS_MODE=queue` and `QUEUE_BULL_REDIS_HOST=redis` on the n8n service,
and add one or more `n8n worker` containers sharing the same environment and
encryption key. Everything else here stays as it is.
