# n8n-sako Agent Instructions

## 1. Project Overview

This is **Sako's n8n Marketing Automations Platform** - a self-hosted n8n instance on Railway for marketing automation workflows.

**Domain:** `n8n.sako.agency`
**Stack:** n8n + Railway + Neon Postgres + Redis + Slack

---

## 2. Useful Commands

| Command | Purpose |
|---------|---------|
| `docker-compose up -d` | Start local dev environment |
| `docker-compose down` | Stop all services |
| `docker-compose logs -f n8n` | Follow n8n logs |
| `docker-compose pull` | Pull latest images |

---

## 3. Project Structure

```
n8n-sako/
├── Dockerfile           # Production image (Railway)
├── docker-compose.yml   # Local development
├── railway.toml         # Railway deployment config
├── .env.example         # Environment variable template
├── README.md            # Setup documentation
├── templates/           # Google Sheets CSV templates
└── workflows/           # n8n workflow JSON exports
    ├── _shared/         # Reusable sub-workflows
    ├── infra/           # Backup, metrics
    ├── leads/           # Lead capture, enrichment
    ├── content/         # Content generation, scheduling
    ├── analytics/       # Weekly reports
    └── pr/              # PR engine workflows
```

---

## 4. Tech Stack

- **Automation:** n8n 2.6.3 (self-hosted)
- **Database:** Neon PostgreSQL 17 (pooler endpoint, ap-southeast-1)
- **Deployment:** Railway (single-process `regular` mode — no Redis needed)
- **Local Dev:** Docker Compose with Redis (queue mode)
- **AI Models:** OpenAI GPT-5.2 family (per Latest-Models-Only rule)

---

## 5. Non-Negotiables

1. **Use official n8n image** — `docker.n8n.io/n8nio/n8n:2.6.3`
2. **Pin versions** — Never use `latest` tag in production
3. **Do NOT set `N8N_RUNNERS_ENABLED`** — Deprecated in n8n 2.6+, task runners are on by default
4. **Enable file permissions** — `N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true`
5. **Set both timezone vars** — `GENERIC_TIMEZONE` AND `TZ`
6. **Use GPT-5.2 family** — Not gpt-4o/gpt-4o-mini/gpt-3.5-turbo
7. **No secrets in code** — Use environment variables only
8. **Webhook signatures** — Verify all incoming webhooks
9. **Never use `N8N_BASIC_AUTH_*`** — Removed in n8n 1.0. Auth is via built-in User Management (owner account).
10. **`N8N_ENCRYPTION_KEY` must be persistent** — Set it once in Railway, never change it.

---

## 6. Model Policy (Latest-Models-Only)

Per the workspace rule, use ONLY these models in workflows:

| Provider | Allowed Models |
|----------|----------------|
| **OpenAI** | `gpt-5.2`, `gpt-5.2-chat`, `gpt-5.2-pro` |
| **Anthropic** | `claude-opus-4.5`, `claude-sonnet-4.5`, `claude-haiku-4.5` |
| **Google** | `gemini-3-flash`, `gemini-3-pro-preview` |

**Banned models:** gpt-4o, gpt-4o-mini, gpt-3.5-turbo, claude-3.x, gemini-2.x

---

## 7. Environment Variables (Required)

```bash
# Database (Neon Postgres — pooler endpoint)
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=ep-xxx-pooler.ap-southeast-1.aws.neon.tech
DB_POSTGRESDB_DATABASE=neondb
DB_POSTGRESDB_USER=neondb_owner
DB_POSTGRESDB_PASSWORD=
DB_POSTGRESDB_SSL_ENABLED=true
DB_POSTGRESDB_SSL_REJECT_UNAUTHORIZED=false

# Execution mode (regular = single-process, no Redis needed)
EXECUTIONS_MODE=regular

# n8n Config
N8N_PROTOCOL=https
N8N_HOST=n8n.sako.agency
WEBHOOK_URL=https://n8n.sako.agency/
N8N_PROXY_HOPS=1
N8N_PUSH_BACKEND=sse
N8N_EDITOR_BASE_URL=https://n8n.sako.agency/
N8N_SECURE_COOKIE=true
N8N_ENCRYPTION_KEY=  # 32+ hex chars, NEVER change after first deploy
PORT=5678  # Railway routing — do NOT use N8N_PORT (breaks origin validation)

# Auth: n8n uses built-in User Management (NOT basic auth).
# On first launch, complete the owner setup screen (name, email, password).
# All visits then require login. N8N_BASIC_AUTH_* was removed in n8n 1.0.

# Disable survey + telemetry
N8N_PERSONALIZATION_ENABLED=false
N8N_DIAGNOSTICS_ENABLED=false

# Slack (for approvals + commands)
SLACK_BOT_TOKEN=
SLACK_SIGNING_SECRET=

# Best Practices (Feb 2026)
N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
# Do NOT set N8N_RUNNERS_ENABLED — deprecated in 2.6+

# Timezone
GENERIC_TIMEZONE=Asia/Kolkata
TZ=Asia/Kolkata
```

---

## 8. Workflow Categories

| Category | Count | Purpose |
|----------|-------|---------|
| **Shared** | 2 | Webhook auth, error handling |
| **Infra** | 2 | Backups, metrics |
| **Leads** | 4 | Capture, enrichment, email events |
| **Content** | 9 | Generation, scheduling, approval |
| **Analytics** | 1 | Weekly growth reports |
| **PR** | 6 | Hook generation, outreach, tracking |

---

## 9. Slack Command Center

**Slash command:** `/sako` (handled by `workflows/_shared/slack-command-handler.json`)

**Supported commands**
- `/sako help`
- `/sako leads [today|week|all]`
- `/sako brief <email>`
- `/sako qualify <email>`
- `/sako content [pending|approved]`
- `/sako metrics`
- `/sako pr`
- `/sako signals`

**Slack app endpoints**
- Interactivity: `https://n8n.sako.agency/webhook/slack-action`
- Slash commands: `https://n8n.sako.agency/webhook/slack-command`
- App Home events: `https://n8n.sako.agency/webhook/slack-events`

---

## 10. Deployment Checklist

Before deploying to Railway:

- [ ] Set all required env vars in Railway dashboard
- [ ] Configure custom domain `n8n.sako.agency`
- [ ] Verify `WEBHOOK_URL` matches domain
- [ ] Set `N8N_ENCRYPTION_KEY` (generate with `openssl rand -hex 32`) — **never change after first deploy**
- [ ] Set `N8N_PUSH_BACKEND=sse` and `N8N_EDITOR_BASE_URL=https://n8n.sako.agency`
- [ ] Set `N8N_PERSONALIZATION_ENABLED=false` and `N8N_DIAGNOSTICS_ENABLED=false`
- [ ] Deploy and complete the **owner setup screen** (name, email, password) — this is your login
- [ ] Test webhook URLs are accessible
- [ ] Import workflows via n8n UI
