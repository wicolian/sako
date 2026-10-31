# Quick Start Guide - Sako Marketing Automations

> **Get your AI-powered marketing engine running in under 1 hour**

This guide walks you through the initial setup of Sako's automation platform.

---

## Prerequisites

Before you begin, you'll need:

- [ ] Railway account ([railway.app](https://railway.app))
- [ ] Slack workspace with admin access
- [ ] Google account for Sheets
- [ ] Apollo.io account ([apollo.io](https://apollo.io)) - lead database
- [ ] Brevo account ([brevo.com](https://brevo.com)) - email campaigns
- [ ] Quo/OpenPhone account ([quo.com](https://quo.com)) - dialer
- [ ] OpenAI account for GPT-5.2
- [ ] Domain DNS access for `n8n.sako.agency`

---

## Step 1: Deploy to Railway (15 minutes)

### 1.1 Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize project from this repo
railway init
```

### 1.2 Add Databases

In Railway dashboard:
1. Click **+ New** → **Database** → **PostgreSQL**
2. Click **+ New** → **Database** → **Redis**
3. Wait for both to provision (~2 minutes)

### 1.3 Connect GitHub Repo

1. Click **+ New** → **GitHub Repo**
2. Select this repository
3. Railway will auto-detect the Dockerfile

### 1.4 Configure Environment Variables

Go to **Variables** tab and add:

```bash
# Database (use Railway reference variables)
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=${{Postgres.PGHOST}}
DB_POSTGRESDB_DATABASE=${{Postgres.PGDATABASE}}
DB_POSTGRESDB_USER=${{Postgres.PGUSER}}
DB_POSTGRESDB_PASSWORD=${{Postgres.PGPASSWORD}}

# Redis
EXECUTIONS_MODE=queue
QUEUE_BULL_REDIS_HOST=${{Redis.REDISHOST}}
QUEUE_BULL_REDIS_PORT=${{Redis.REDISPORT}}
QUEUE_BULL_REDIS_PASSWORD=${{Redis.REDISPASSWORD}}
QUEUE_HEALTH_CHECK_ACTIVE=true

# Protocol (important for webhooks!)
N8N_PROTOCOL=https
N8N_HOST=n8n.sako.agency
N8N_PORT=5678
WEBHOOK_URL=https://n8n.sako.agency/
N8N_PROXY_HOPS=1
N8N_EXPRESS_TRUST_PROXY=true
N8N_EDITOR_BASE_URL=https://n8n.sako.agency/

# Security (generate unique values!)
N8N_ENCRYPTION_KEY=<run: openssl rand -hex 32>
# Auth: N8N_BASIC_AUTH_* was removed in n8n 1.0. Do NOT use it.
# n8n uses built-in User Management. On first launch, complete the owner
# setup screen (name, email, password). All visits then require login.

# Execution settings
EXECUTIONS_DATA_PRUNE=true
EXECUTIONS_DATA_MAX_AGE=168
EXECUTIONS_DATA_SAVE_ON_ERROR=all
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none
EXECUTIONS_DATA_SAVE_MANUAL_EXECUTIONS=true

# Best practices
N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
N8N_RUNNERS_ENABLED=true

# Timezone
GENERIC_TIMEZONE=Asia/Kolkata
TZ=Asia/Kolkata
```

### 1.5 Add Custom Domain

1. Go to **Settings** → **Networking** → **Public Networking**
2. Add custom domain: `n8n.sako.agency`
3. Add the DNS records Railway provides
4. Wait for SSL certificate (~5 minutes)

### 1.6 Verify Deployment

```bash
# Check health
curl https://n8n.sako.agency/healthz

# Should return: {"status":"ok"}
```

---

## Step 2: Set Up Google Sheets (10 minutes)

### 2.1 Create Master Spreadsheet

1. Go to [Google Sheets](https://sheets.google.com)
2. Create new spreadsheet: "Sako Marketing Automations"
3. Create these sheets (tabs) - use the CSV templates in `/templates/`:

**Core Lead Sheets (Feb Sprint - Priority):**

| Sheet Name | Purpose | Template |
|------------|---------|----------|
| `apollo_import` | Import Apollo contacts for ICP filtering | `templates/apollo_import.csv` |
| `qualified_leads` | ICP-qualified leads (score >= 70) | `templates/qualified_leads.csv` |
| `disqualified_leads` | Filtered out contacts (score < 70) | `templates/disqualified_leads.csv` |
| `warm_opens` | Daily warm opens for calling | `templates/warm_opens.csv` |
| `call_tracker` | the caller's call log (auto-logged via Quo) | `templates/call_tracker.csv` |
| `suppression_list` | Bounces, complaints, unsubscribes | `templates/suppression_list.csv` |

**Content & PR Sheets:**

| Sheet Name | Purpose | Template |
|------------|---------|----------|
| `content_backlog` | Content ideas queue | `templates/content_backlog.csv` |
| `pr_backlog` | PR hook ideas | `templates/pr_backlog.csv` |
| `media_targets` | Journalist/outlet contacts | `templates/media_targets.csv` |
| `coverage` | Media coverage tracking | `templates/coverage.csv` |
| `journalist_profiles` | Detailed journalist info | `templates/journalist_profiles.csv` |
| `industry_news` | Scraped industry news | `templates/industry_news.csv` |
| `campaign_links` | UTM tracking | `templates/campaign_links.csv` |
| `idempotency_log` | Dedup log | `templates/idempotency_log.csv` |

### 2.2 Add Sample Data

Add one row to each sheet so n8n can detect columns:

**content_backlog:**
```
cb_001, teardown, SaaS homepage teardown for conversion, LI, , , queued, , , 2026-01-29
```

**pr_backlog:**
```
pr_001, Sako shipped X feature in 48h, shipping, [], queued, low
```

**media_targets:**
```
Example SaaS Podcast, host@example.com, podcast, SaaS founders building design systems, ,
```

### 2.3 Create Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create project: "Sako Automations"
3. Enable APIs:
   - Google Sheets API
   - Google Analytics Data API
   - Search Console API
4. Create Service Account:
   - IAM & Admin → Service Accounts → Create
   - Name: "n8n-automation"
   - Download JSON key
5. Share Google Sheet with service account email

---

## Step 3: Set Up Slack (10 minutes)

### 3.1 Create Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App** → **From scratch**
3. Name: "Sako Automations"
4. Select your workspace

### 3.2 Configure OAuth Scopes

Go to **OAuth & Permissions** → **Scopes** → **Bot Token Scopes**:
- `chat:write`
- `chat:write.public`

### 3.3 Install to Workspace

1. Click **Install to Workspace**
2. Copy **Bot User OAuth Token** (starts with `xoxb-`)

### 3.4 Create Channels

Create these channels (or adjust names):
- `#sako-leads`
- `#content-review`
- `#pr-ideas`
- `#pr-wins`
- `#sako-growth`
- `#n8n-errors`
- `#sako-alerts`

### 3.5 Invite Bot to Channels

In each channel, type: `/invite @Sako Automations`

---

## Step 4: Configure n8n Credentials (15 minutes)

### 4.1 Access n8n Editor

1. Go to `https://n8n.sako.agency`
2. Login with basic auth credentials

### 4.2 Add Credentials

Go to **Settings** → **Credentials** → **Add Credential**

**Core GTM Stack (Required for Feb Sprint):**

| Credential Type | Name | Required Fields |
|-----------------|------|-----------------|
| **Google Sheets OAuth** | Google Sheets OAuth | Client ID, Client Secret (from service account) |
| **Slack OAuth** | Slack OAuth | Bot Token, Signing Secret |
| **HTTP Header Auth** | Apollo API | Header: `x-api-key`, Value: `<your-apollo-api-key>` |
| **HTTP Header Auth** | Brevo API | Header: `api-key`, Value: `<your-brevo-api-key>` |
| **HTTP Header Auth** | Quo API | Header: `Authorization`, Value: `Bearer <your-quo-api-key>` |
| **OpenAI API** | OpenAI API | API Key (for GPT-5.2) |

**Optional Integrations:**

| Credential Type | Name | Required Fields |
|-----------------|------|-----------------|
| **HTTP Header Auth** | Sako API | Header: `Authorization`, Value: `Bearer <api-key>` |
| **HTTP Header Auth** | PostHog API | Header: `Authorization`, Value: `Bearer <api-key>` |
| **HTTP Header Auth** | Apify API | Header: `Authorization`, Value: `Bearer <api-key>` |

### 4.3 Install Apify Community Node

1. Go to **Settings** → **Community Nodes**
2. Click **Install**
3. Enter: `@apify/n8n-nodes-apify`
4. Click **Install**

### 4.4 Set Apify Token

Add environment variable in Railway:
```bash
APIFY_API_TOKEN=<your-token-from-apify.com>
```

### 4.5 Set Cal.com Vars

Add environment variables in Railway:
```bash
CALCOM_API_KEY=<your-calcom-api-key>
CALCOM_BOOKING_LINK=https://cal.com/your-handle/intro-call
```

---

## Step 5: Configure Webhooks (10 minutes)

### 5.1 Brevo Webhooks

1. Go to Brevo → Transactional → Webhooks
2. Add webhook:
   - URL: `https://n8n.sako.agency/webhook/brevo-events`
   - Events: `hard_bounce`, `soft_bounce`, `complaint`, `unsubscribed`, `blocked`

### 5.2 Quo (OpenPhone) Webhooks

1. Go to Quo → Settings → Developer → Webhooks
2. Add webhook:
   - URL: `https://n8n.sako.agency/webhook/quo-call-completed`
   - Events: `call.completed`
3. Note: Quo auto-logs calls to the `call_tracker` sheet

### 5.3 Cal.com Webhook

1. Go to Cal.com → Settings → Developer → Webhooks
2. Add webhook:
   - URL: `https://n8n.sako.agency/webhook/calcom-booking`
   - Events: `BOOKING_CREATED`
3. Save

---

## Step 6: Import Workflows

### 6.1 Import Core Workflows

In n8n editor:
1. Click **Workflows** → **Import from File**
2. Import each JSON from `workflows/` folder:

**Import order (dependencies first):**

1. `_shared/error-handler.json`
2. `_shared/apify-runner.json`

**Feb Sprint Workflows (Priority):**
3. `leads/apollo-icp-qualifier.json` - ICP filtering
4. `leads/brevo-warm-opens.json` - Daily warm opens to Slack
5. `leads/quo-call-logger.json` - Auto-log calls
6. `leads/mark-called-handler.json` - Slack button handler
7. `leads/company-enrichment.json` - Apollo enrichment
8. `leads/call-prep-brief.json` - Generate call briefs
9. `leads/handle-email-events.json` - Brevo bounce handling

**Other Workflows:**
10. All `content/*.json`
11. All `pr/*.json`
12. `analytics/weekly-growth-report.json`
13. `infra/*.json`

### 6.2 Update Sheet IDs

For each workflow that uses Google Sheets:
1. Open workflow
2. Find Google Sheets nodes
3. Click on the node → Select your spreadsheet from the dropdown
4. Select the correct sheet name (tab)

### 6.3 Activate Workflows

**Activate these for Feb Sprint:**
- `brevo-warm-opens` (runs daily at 8am IST)
- `quo-call-logger` (webhook - always listening)
- `mark-called-handler` (webhook - always listening)
- `handle-email-events` (webhook - always listening)
- `error-handler`

**Run manually as needed:**
- `apollo-icp-qualifier` - Run once on your Apollo export
- `company-enrichment` - Run on batches of qualified leads
- `call-prep-brief` - Triggered from Slack buttons

---

## Step 7: Test Everything

### 7.1 Test ICP Qualifier

1. Upload your Apollo contacts to `apollo_import` sheet
2. Run `apollo-icp-qualifier` workflow manually
3. Check `qualified_leads` and `disqualified_leads` sheets
4. Verify `#sako-leads` shows summary

### 7.2 Test Warm Opens Flow

1. Run `brevo-warm-opens` workflow manually
2. Check `#sako-leads` for warm open notifications
3. Click "Generate Full Brief" button
4. Verify brief appears in Slack

### 7.3 Test Call Logging

1. Make a test outbound call from Quo
2. Verify call appears in `call_tracker` sheet
3. Check if `warm_opens` status was updated (if contact matched)

### 7.4 Test Error Handling

1. Open any workflow
2. Temporarily break a node (wrong URL)
3. Execute workflow
4. Verify `#n8n-errors` gets alert

---

## You're Done!

Your Feb Sprint automation engine is now running:

| Event | What Happens |
|-------|--------------|
| Daily 8am IST | Warm opens pulled from Brevo → posted to `#sako-leads` |
| When the caller calls | Quo auto-logs to `call_tracker`, updates `warm_opens` status |
| Click "Generate Brief" | AI-generated call prep posted to Slack |
| Email bounce/complaint | Auto-added to `suppression_list`, blacklisted in Brevo |
| Workflow error | Alert sent to `#n8n-errors` |

---

## Next Steps

1. Read the full [User Guide](./USER_GUIDE.md)
2. **Run ICP qualifier** on your 238 Apollo contacts
3. **Review qualified leads** - should be ~60-80 contacts
4. **Set up Brevo campaign** to qualified leads
5. **Train the caller** on `#sako-leads` workflow

---

## Troubleshooting First-Time Issues

### "Webhook URL shows localhost"
Restart the n8n service after setting `WEBHOOK_URL` environment variable.

### "Google Sheets not found"
Make sure you shared the spreadsheet with the service account email.

### "Slack messages not posting"
Verify the bot was invited to each channel with `/invite @Sako Automations`.

### "Apollo API returns 401"
Check the `x-api-key` header is set correctly in credentials.

### "Brevo opens not showing"
Verify the date range in the workflow matches when you sent campaigns.

### "Quo calls not logging"
Ensure the webhook URL is correct: `https://n8n.sako.agency/webhook/quo-call-completed`

---

*Setup complete! Your Feb Sprint GTM machine is ready.*
