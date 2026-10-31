# Fix "Connection lost" in n8n on Railway

If you see a red "Connection lost" banner in the n8n editor, the push connection (real-time updates) is failing.

## Root cause

n8n 2.x validates the `Origin` header on the `/rest/push` endpoint as CSRF protection (`origin-validator.ts`). **Railway's reverse proxy strips the `Origin` header** from all forwarded requests. Without Origin, the validation always returns 500.

This cannot be fixed with environment variables alone — the Origin header is required by n8n's source code (`inProduction` check in `push/index.ts`).

## The fix: Caddy reverse proxy

We add a lightweight [Caddy](https://caddyserver.com/) reverse proxy inside the Docker container that injects the missing `Origin` header before requests reach n8n:

```
Railway proxy (:443 HTTPS) -> Caddy (:5678) -> n8n (:5679)
```

**Files involved:**
- `Caddyfile` — Caddy config: injects `Origin`, `X-Forwarded-Proto`, `X-Forwarded-Host`
- `start.sh` — Starts Caddy in background, then n8n on internal port
- `Dockerfile` — Installs Caddy, uses `start.sh` as entrypoint

## Required Railway Variables

```bash
N8N_PROTOCOL=https
N8N_HOST=n8n.sako.agency
N8N_EDITOR_BASE_URL=https://n8n.sako.agency
WEBHOOK_URL=https://n8n.sako.agency
N8N_PROXY_HOPS=1
N8N_PUSH_BACKEND=sse
N8N_SECURE_COOKIE=true
PORT=5678          # Railway routing — do NOT use N8N_PORT
```

**Do NOT set `N8N_PORT`** — it's managed internally by `start.sh` (set to 5679).

## If it still says "Connection lost"

1. Check Railway logs for Caddy startup errors
2. Verify `PORT=5678` is set in Railway Variables
3. Make sure `N8N_PORT` is NOT set in Railway Variables
4. Hard-refresh the browser (Cmd+Shift+R)

## Reference

- [n8n origin-validator.ts source](https://github.com/n8n-io/n8n/blob/n8n%402.6.3/packages/cli/src/push/origin-validator.ts)
- [Railway community discussion](https://station.railway.com/questions/my-n8n-is-lost-connection-please-check-5af6cbc5)
- [n8n GitHub issue #21059](https://github.com/n8n-io/n8n/issues/21059)
