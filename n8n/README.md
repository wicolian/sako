# Sako Marketing Automations (n8n on Railway)

Automated marketing workflows for Sako's moonlighting GTM team: lead qualification, warm open tracking, call prep, and content publishing.

**Domain:** `n8n.sako.agency`

---

## The Machine (Feb 2026)

```
LIST OWNER (Lists + Email)              CALLER (Calls)
────────────────────               ─────────────────
Apollo contacts (238)
        │
        ▼
┌──────────────────┐
│ apollo-icp-      │  "238 → ~80 qualified"
│ qualifier        │
└────────┬─────────┘
         │
         ▼
Brevo Campaign ─────────────────────────────┐
                                            │
                                            ▼
                                   ┌─────────────────┐
                                   │ brevo-warm-opens │
                                   │ (daily 8am)      │
                                   └────────┬────────┘
                                            │
                                            ▼
                                   #sako-leads (Slack)
                                            │
                                            ▼
                                   the caller calls with
                                   auto-generated script
                                            │
                                            ▼
                                   ┌─────────────────┐
                                   │ quo-call-logger │
                                   │ (auto-logs)     │
                                   └─────────────────┘
```

---

## Core GTM Stack

| Service | Purpose | Docs |
|---------|---------|------|
| **Apollo** | Lead database + enrichment | [docs.apollo.io](https://docs.apollo.io/docs) |
| **Brevo** | Email campaigns + open tracking | [developers.brevo.com](https://developers.brevo.com/docs/getting-started) |
| **Quo** | Dialer + call transcriptions | [quo.com/docs](https://www.quo.com/docs/mdx/api-reference/introduction) |
| **n8n** | Workflow automation | [docs.n8n.io](https://docs.n8n.io) |

---

## Documentation

| Document | Description |
|----------|-------------|
| [Quick Start](./docs/QUICK_START.md) | First-time setup (1 hour) |
| [Slack Setup](./docs/SLACK_SETUP.md) | Event Subscriptions, URL verification, correct webhook URL |
| [User Guide](./docs/USER_GUIDE.md) | Complete system documentation |
| [Operations Runbook](./docs/OPERATIONS_RUNBOOK.md) | Day-to-day procedures |
| [Deployment Checklist](./docs/DEPLOYMENT_CHECKLIST.md) | Import order + verification steps |

---

## Quick Start (Local Development)

```bash
# Start all services (n8n, Postgres, Redis, worker)
docker-compose up -d

# Access n8n editor
open http://localhost:5678

# View logs
docker-compose logs -f n8n

# Stop all services
docker-compose down
```

## Railway Deployment

### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Create new project
railway init
```

### 2. Add Services

In Railway dashboard:
1. Add **Postgres** plugin
2. Add **Redis** plugin
3. Connect this repo as a service

### 3. Configure Environment Variables

Set these in Railway dashboard → Variables:

```bash
# Database (use Railway's Postgres plugin variables)
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=${{Postgres.PGHOST}}
DB_POSTGRESDB_DATABASE=${{Postgres.PGDATABASE}}
DB_POSTGRESDB_USER=${{Postgres.PGUSER}}
DB_POSTGRESDB_PASSWORD=${{Postgres.PGPASSWORD}}

# Redis (use Railway's Redis plugin variables)
EXECUTIONS_MODE=queue
QUEUE_BULL_REDIS_HOST=${{Redis.REDISHOST}}
QUEUE_BULL_REDIS_PORT=${{Redis.REDISPORT}}
QUEUE_BULL_REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
QUEUE_HEALTH_CHECK_ACTIVE=true

# Protocol + Proxy
N8N_PROTOCOL=https
N8N_HOST=n8n.sako.agency
N8N_PORT=5678
WEBHOOK_URL=https://n8n.sako.agency/
N8N_PROXY_HOPS=1
N8N_EXPRESS_TRUST_PROXY=true
N8N_EDITOR_BASE_URL=https://n8n.sako.agency/

# Encryption (generate with: openssl rand -hex 32)
N8N_ENCRYPTION_KEY=<your-32-char-key>

# Auth: N8N_BASIC_AUTH_* was removed in n8n 1.0.
# n8n uses built-in User Management — complete the owner setup on first launch.
# See: https://docs.n8n.io/hosting/configuration/user-management-self-hosted/

# Pruning
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=168
EXECUTIONS_DATA_SAVE_ON_ERROR=all
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=true

# Timezone
GENERIC_TIMEZONE=Asia/Kolkata

# Apify (for web scraping enrichment)
APIFY_API_TOKEN=<your-apify-api-token>
```

**Railway Postgres:** The Postgres plugin’s default database is often `railway`. Using `${{Postgres.PGDATABASE}}` is enough; you don’t need a separate `n8n` database unless you want one.

**Security:** Don’t paste real DB passwords in chat or commit them. If the Postgres password was exposed, regenerate it in Railway: Postgres service → **Variables** or **Settings** → **Regenerate Password**, then update the n8n service variable that references it.

### 4. Install Apify Community Node

In n8n editor:
1. Go to **Settings** → **Community Nodes**
2. Click **Install**
3. Enter: `@apify/n8n-nodes-apify`
4. Click **Install** and wait for completion

### 5. Configure Custom Domain

1. Go to Railway dashboard → Settings → Domains
2. Add custom domain: `n8n.sako.agency`
3. Add DNS records as instructed by Railway
4. Wait for SSL certificate (automatic)

### 5. Verify Deployment

```bash
# Check webhook URL is correct
curl https://n8n.sako.agency/healthz

# Test a webhook endpoint
curl -X POST https://n8n.sako.agency/webhook/test
```

## Directory Structure

```
n8n-sako/
├── railway.toml              # Railway config
├── Dockerfile                # Production container
├── docker-compose.yml        # Local development
├── .env.example              # Environment template
├── README.md                 # This file
│
├── workflows/                # n8n workflow JSON exports
│   ├── _shared/              # Reusable sub-workflows
│   ├── infra/                # Backup, metrics
│   ├── leads/                # Lead capture, call prep
│   ├── content/              # Content engine, UTM
│   ├── analytics/            # Weekly reports
│   └── pr/                   # PR hooks, outreach, coverage
│
└── templates/                # Google Sheet templates
    ├── qualified_leads.csv      # Output from ICP qualifier
    ├── disqualified_leads.csv   # Contacts that didn't pass ICP
    ├── warm_opens.csv           # Daily warm opens for calling
    ├── call_tracker.csv         # the caller's call log
    ├── hiring_signals.csv       # Companies hiring designers (warm leads)
    ├── content_backlog.csv
    ├── content_monitor_targets.csv
    ├── industry_news.csv
    ├── journalist_profiles.csv
    ├── pr_backlog.csv
    ├── media_targets.csv
    ├── suppression_list.csv
    ├── idempotency_log.csv
    ├── campaign_links.csv
    └── coverage.csv
```

## Workflows

### Lead Qualification (Feb Sprint - Core)
- **apollo-icp-qualifier** - Filter Apollo contacts by ICP criteria (role, company size, industry)
- **brevo-warm-opens** - Daily 8am: Pull email opens from Brevo → Post to #sako-leads with call script
- **quo-call-logger** - Auto-log calls from Quo dialer → Update warm_opens status
- **mark-called-handler** - Webhook for Slack buttons (Mark as Called, Meeting Booked, Skip)
- **call-prep-brief** - Generate 1-page call prep brief with company research + suggested opener
- **linkedin-hiring-signal-monitor** - Weekly: Scrape LinkedIn jobs → flag companies hiring designers

### Lead Capture (Original)
- **lead-intake-router** - Multi-channel lead intake with dedupe, enrichment, scoring
- **handle-email-events** - Process bounces, complaints, unsubscribes (Brevo webhooks)
- **company-enrichment** - Scrape websites → Extract value prop, industry, ICP fit with AI

### Content Engine
- **content-generator** - Draft content with LLM, Slack approval gate
- **utm-link-generator** - Generate UTM links and shortlinks
- **content-performance** - Track performance, trigger repurpose tasks
- **claims-safety-checker** - Validate marketing claims
- **trends-social-poster** - Google Trends (SerpAPI + Apify) → Perplexity research → Multi-platform posting
- **linkedin-agent** - LangChain agent → Topic generation → DALL-E images → LinkedIn
- **video-avatar-publisher** - VEED AI avatars → Multi-platform video publishing

### Analytics
- **weekly-growth-report** - GA4 + PostHog + Search Console summary

### PR Engine
- **pr-hook-generator** - Weekly PR hook ideas from shipped work + Google Trends + Google News + X/Twitter trends (via Apify)
- **earned-media-outreach** - Personalized outreach to media targets with LinkedIn profile enrichment + email verification gate (via Apify)
- **newsroom-publisher** - Update /press page on trysako.com
- **coverage-tracker** - Classify and track coverage with full article extraction (via Apify)
- **media-kit-generator** - Auto-build media kit folder
- **journalist-monitor** - Monitor journalist requests
- **reddit-monitor** - Reddit search → summarize signals → Slack (via Apify)
- **media-target-discovery** - Discover new media targets on LinkedIn → append to `media_targets` (via Apify)

### Infrastructure
- **webhook-auth** - Reusable signature verification
- **error-handler** - Central error handling + Slack alerts
- **backup-workflows** - Daily backup to S3/R2
- **metrics-reporter** - Per-workflow health metrics
- **competitor-content-monitor** - Monitor competitor pages for changes → Slack (via Apify)

## Webhook Endpoints

| Source | Path | Auth Header |
|--------|------|-------------|
| Cal.com | `/webhook/calcom-booking` | X-Cal-Signature-256 |
| Calendly | `/webhook/calendly-event` | Calendly-Webhook-Signature |
| Slack | `/webhook/slack-action` | X-Slack-Signature |
| Resend | `/webhook/resend-events` | Webhook secret |

## Security

### Editor Access
- Basic auth enabled by default
- Consider adding Cloudflare Access for IP allowlist
- Never expose editor without authentication

### Webhook Security
- All webhooks verify signatures before processing
- Use the `webhook-auth` sub-workflow for validation
- Store secrets in n8n credentials, not in workflows

## Apify Integration

This project uses [Apify](https://apify.com) for web scraping and data enrichment. Apify provides a free tier with **$5/month in credits** that renews monthly.

### What Apify Enriches

1. **Lead Enrichment** (`lead-intake-router`, `company-enrichment`)
   - Contact info scraper: emails, phones, social links from company websites
   - Fallback when Clearbit fails or provides incomplete data

2. **PR Coverage** (`coverage-tracker`)
   - Article extractor: full article content, author, publication date
   - Improves classification accuracy from 60% (RSS titles) to 90% (full content)

3. **Media Outreach** (`earned-media-outreach`)
   - LinkedIn profile scraper: journalist profiles, recent work, writing style
   - Enables personalized pitches based on their coverage history
   - Email verifier: blocks sending to invalid / "do not send" targets before Resend

4. **PR Hooks** (`pr-hook-generator`)
   - Google Trends scraper: deeper trend analysis than SerpAPI
   - Google News scraper: industry news monitoring for timely hooks
   - X/Twitter trends scraper: what people are talking about right now

5. **Content Trends** (`trends-social-poster`)
   - Google Trends scraper: additional trend data for content inspiration

6. **Company Insights** (`call-prep-brief`, `company-enrichment`)
   - LinkedIn company insights: headcount/job openings signals when a company URL is available

7. **Signals & Monitoring** (`reddit-monitor`, `competitor-content-monitor`)
   - Reddit monitoring: daily/12-hour idea + pain-point signals for content + PR
   - Competitor change detection: alerts when key pages (pricing, landing pages) change

### Setup

1. Create account at [apify.com](https://apify.com) (free tier available)
2. Get API token from [Apify Console → Settings → Integrations](https://console.apify.com/account/integrations)
3. Set `APIFY_API_TOKEN` in Railway/environment variables
4. Install `@apify/n8n-nodes-apify` community node in n8n (see step 4 above)

For monitoring workflows, create a Slack channel (or update workflows) for `#signals`.

### Cost Management

The free tier ($5/month) supports:
- ~750 company contact enrichments
- ~150 article extractions
- ~50 trend queries
- ~100-250 LinkedIn profiles

All workflows cache results in Google Sheets to avoid re-scraping.

## Monitoring

### Error Alerts
All workflow failures ping `#n8n-errors` Slack channel with:
- Workflow name
- Failed node
- Error message
- Link to execution

### Health Metrics
Daily metrics tracked:
- Success rate per workflow
- Average execution time
- Rate limit hits
- Retry counts

## Email Deliverability

Before sending emails, ensure DNS is configured:

```
# SPF
v=spf1 include:_spf.resend.com ~all

# DKIM
resend._domainkey.mail.trysako.com  CNAME  <from-resend>

# DMARC
_dmarc.mail.trysako.com  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@trysako.com"
```

## Troubleshooting

### Webhooks showing localhost
Ensure these env vars are set:
```
WEBHOOK_URL=https://n8n.sako.agency/
N8N_PROXY_HOPS=1
N8N_EXPRESS_TRUST_PROXY=true
```

### Queue not processing
Check Redis connection:
```bash
docker-compose logs redis
docker-compose exec redis redis-cli ping
```

### Postgres filling up
Check pruning is enabled:
```
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=168
```

### Sync workflows to production (no duplicates)
After deploy, push workflow JSONs from the repo to your n8n instance. Uses the REST API: **update if exists, create if not** (no duplicates).

1. In n8n: **Settings → n8n API → Create API key**. Copy the key.
2. Set env (or add to `.env` / Railway):
   - `N8N_BASE_URL=https://n8n.sako.agency`
   - `N8N_API_KEY=<your-key>`
3. Run:
   ```bash
   node scripts/sync-workflows.mjs
   ```
   Or with Railway env: `railway run node scripts/sync-workflows.mjs`

Workflows are synced in dependency order (see `docs/PUBLISH_ORDER.md`). Existing workflows are updated in place; new ones are created. Active/inactive state is preserved.

**Alternative (CLI, inside n8n container):** If you have n8n CLI and the workflow files on the same machine/container, you can run `n8n import:workflow --separate --input=/path/to/workflows`; workflows with a root `id` in the JSON will overwrite existing ones with the same id.

### Clean up duplicate workflows (no psql)
To remove all workflows and executions from Railway Postgres without installing `psql`:

```bash
npm install
railway run node scripts/cleanup-n8n-workflows.mjs
```

Or with an explicit Postgres URL:  
`DATABASE_URL="postgresql://user:pass@host:port/db" node scripts/cleanup-n8n-workflows.mjs`

Uses `DB_POSTGRESDB_*` from Railway when `DATABASE_URL` is not set.

## License

Private - Sako internal use only.
