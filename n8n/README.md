# n8n — CollabOS ingestion layer

Self-hosted (free Community edition). n8n receives messages from your connected
channels and forwards each one to the CollabOS app.

There are two stacks in here:

| | This directory | [`vps/`](vps/README.md) |
| --- | --- | --- |
| Where | Your laptop | An Ubuntu VPS |
| URL | `http://localhost:5678` | `https://n8n.yourdomain.com` |
| TLS | none | Caddy + automatic Let's Encrypt |
| Real provider webhooks | no (needs a tunnel) | yes |
| For | building and testing workflows | running them |

Build workflows locally, then export them (**Workflow → Download**) and import
them on the VPS. Credentials do not travel with the export — recreate those on
the server.

---

## Run locally

```bash
cd n8n && cp .env.example .env
```

```bash
openssl rand -hex 32
```

Put that in `N8N_ENCRYPTION_KEY`, set a `POSTGRES_PASSWORD`, then:

```bash
docker compose up -d
```

Open `http://localhost:5678` and create your local owner account.
`docker compose down` stops it; data persists in the named volumes.

## Run in production

See **[vps/README.md](vps/README.md)** — full runbook: server prep, DNS, TLS,
first login, backups, provider webhook registration, troubleshooting.

---

## The one node that talks to CollabOS

Every channel workflow ends in an **HTTP Request** node:

- Method: `POST`
- URL: `https://collab-os-geoy.vercel.app/api/ingest` — the production app on
  Vercel. Works from the laptop stack and the VPS alike, no `npm run dev`
  needed. Use `http://host.docker.internal:3000/api/ingest` only when you want
  to hit a local dev server instead (that hostname exists only on Docker Desktop)
- Auth: a **Header Auth** credential named `x-webhook-secret`, whose value is
  the app's `N8N_WEBHOOK_SECRET`
- Body (JSON):

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

`external_message_id` is what makes n8n retries safe — always send it.

## Testing real webhooks from the laptop

Meta and Google must reach n8n over the public internet. For local dev, tunnel:

```bash
cloudflared tunnel --url http://localhost:5678
```

Then set `WEBHOOK_URL` to the tunnel URL, restart, and register that URL in the
Meta App dashboard / Gmail push config. Until then, use each trigger node's
"Listen for test event" or the manual trigger to test end to end. Once you have
the VPS up, skip all of this and register the real `https://` URL instead.

## Driving n8n from Claude via MCP (optional)

1. In n8n: Settings → API → create an API key.
2. Add the MCP server (in an interactive terminal, not this session):

```bash
claude mcp add n8n -- npx n8n-mcp
```

   with env `N8N_API_URL=http://localhost:5678` and `N8N_API_KEY=<the key>`.
3. Then Claude can create/validate/deploy these workflows for you directly.
