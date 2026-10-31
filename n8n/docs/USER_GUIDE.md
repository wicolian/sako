# Sako Marketing Automations - User Guide

> **Complete guide for running Sako's AI-powered marketing operations as a solo founder**

Welcome to Sako's automation platform. This system runs your entire marketing engine on autopilot—lead capture, content creation, PR outreach, and analytics—so you can focus on shipping design work.

**Domain:** `n8n.sako.agency`

---

## Table of Contents

1. [Philosophy: AI-First Operations](#philosophy-ai-first-operations)
2. [System Overview](#system-overview)
3. [Daily Operations](#daily-operations)
4. [Workflow Deep Dives](#workflow-deep-dives)
5. [Google Sheets Setup](#google-sheets-setup)
6. [Slack Channels](#slack-channels)
7. [Cost Management](#cost-management)
8. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
9. [Extending the System](#extending-the-system)

---

## Philosophy: AI-First Operations

Sako operates without a traditional marketing team. Instead, you have:

| Traditional Role | Sako's AI Replacement |
|------------------|----------------------|
| SDR/BDR | Lead Intake Router + Company Enrichment |
| Content Writer | Content Generator + Trends Social Poster |
| Social Media Manager | UTM Link Generator + Manual publishing |
| PR Specialist | PR Hook Generator + Earned Media Outreach |
| Growth Analyst | Weekly Growth Report |

**Your role:** Review, approve, and occasionally intervene. The system handles 90% of the work.

### The Human-in-the-Loop Pattern

Every automated action that reaches the outside world has an approval gate:

```
AI generates → Slack notification → You approve/reject → Action executes
```

This means:
- **No rogue emails** - You approve every outreach before it sends
- **No bad content** - You pick from AI-generated variants before posting
- **No wasted money** - You see costs before they run

---

## System Overview

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SAKO AUTOMATIONS                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INBOUND                        OUTBOUND                        │
│  ────────                       ────────                        │
│  Cal.com ──┐                    ┌── LinkedIn                    │
│  Calendly ─┼─→ Lead Router ─────┼── X/Twitter                   │
│  Website ──┘        │           └── Email (Resend)              │
│                     ▼                                            │
│              ┌─────────────┐                                     │
│              │   Enrichment │                                    │
│              │  (Clearbit + │                                    │
│              │    Apify)    │                                    │
│              └─────────────┘                                     │
│                     │                                            │
│                     ▼                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   GOOGLE SHEETS                          │    │
│  │  (Your single source of truth for all marketing data)   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                     │                                            │
│         ┌──────────┼──────────┐                                 │
│         ▼          ▼          ▼                                 │
│    ┌────────┐ ┌────────┐ ┌────────┐                            │
│    │Content │ │   PR   │ │Analytics│                            │
│    │ Engine │ │ Engine │ │ Engine │                            │
│    └────────┘ └────────┘ └────────┘                            │
│         │          │          │                                 │
│         └──────────┼──────────┘                                 │
│                    ▼                                            │
│              ┌──────────┐                                       │
│              │  SLACK   │                                       │
│              │ (Alerts, │                                       │
│              │ Approvals)│                                       │
│              └──────────┘                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow Categories

| Category | Count | Purpose | Runs |
|----------|-------|---------|------|
| **Shared** | 3 | Reusable utilities (Apify, errors, auth) | On demand |
| **Leads** | 4 | Capture, enrich, score leads | Webhook-triggered |
| **Content** | 9 | Generate, approve, schedule content | Daily + On demand |
| **PR** | 6 | Generate hooks, outreach, track coverage | Weekly + On demand |
| **Analytics** | 1 | Weekly growth report | Monday 8am |
| **Infra** | 2 | Backups, health metrics | Daily |

---

## Daily Operations

### Morning Routine (5 minutes)

1. **Check `#content-review` in Slack**
   - Review AI-generated content variants
   - Approve (click button) or reject
   - Approved content gets a tracking link added

2. **Check `#sako-leads` in Slack**
   - See any high-intent leads from yesterday
   - Review lead scores and enrichment data
   - Prepare for calls if scheduled

3. **Check `#n8n-errors` in Slack**
   - If empty: Great, everything's working
   - If alerts: Check the linked execution

### Weekly Routine

**Monday:**
- `#sako-growth` receives Weekly Growth Report (8am)
- `#pr-ideas` receives 10 new PR hooks (10am)
- Review PR hooks, mark best ones as "approved" in sheet

**When you ship work:**
- Update completed tasks in your task tracker
- PR Hook Generator will use this data next Monday

### Monthly Routine

1. **Review Apify credits**
   - Go to [apify.com/console](https://console.apify.com)
   - Check remaining credits ($5 free tier)
   - Review which actors used most credits

2. **Clean up Google Sheets**
   - Archive old content from `content_backlog`
   - Archive sent PR items from `pr_backlog`
   - Review `suppression_list` for accuracy

3. **Review workflow performance**
   - Check `metrics-reporter` output
   - Look for workflows with low success rates

---

## Workflow Deep Dives

### 1. Lead Capture & Enrichment

#### Lead Intake Router (`lead-intake-router`)

**Trigger:** Cal.com or Calendly booking webhook

**What it does:**
1. Verifies webhook signature (security)
2. Normalizes data from different sources
3. Checks for duplicates (idempotency)
4. Checks suppression list
5. Enriches with Clearbit (company/person data)
6. Enriches with Apify (contact scraping fallback)
7. Scores the lead (0-100)
8. Notifies Slack if high-intent (70+)
9. Syncs to Sako API

**Lead Scoring Criteria:**

| Factor | Points | Example |
|--------|--------|---------|
| SMB company size (50-500) | +20 | 150 employees |
| Founder/CEO title | +30 | "CEO & Founder" |
| Director level | +25 | "VP of Product" |
| SaaS/Tech industry | +20 | Software company |
| Booked call | +20 | Always (intent signal) |
| Enriched successfully | +5 | Clearbit found data |

**High Intent = 70+ points**

#### Company Enrichment (`company-enrichment`)

**Trigger:** Manual (execute button)

**What it does:**
1. Reads domains from Google Sheet
2. Scrapes each website
3. Uses AI to extract:
   - Value proposition
   - Industry classification
   - Target audience
   - B2B vs B2C
   - Design maturity
   - Design subscription fit
4. Scrapes contact info via Apify
5. Updates Google Sheet with results

**Use case:** When you have a list of target companies and want to qualify them for outreach.

---

### 2. Content Engine

#### Content Generator (`content-generator`)

**Trigger:** Daily at 9am IST

**What it does:**
1. Checks `content_backlog` sheet for "queued" items
2. Takes the first queued item
3. Generates 3 content variants using GPT-5.2
4. Posts to `#content-review` with approve buttons
5. Updates sheet status to "needs_approval"

**Content Pillars:**
- `teardown` - SaaS homepage/landing page teardowns
- `tips` - Actionable design tips
- `case_study` - Client success stories
- `industry` - Design industry insights
- `founder_pov` - Your hot takes

**Formats:**
- `LI` - LinkedIn post (150-300 words)
- `X` - Twitter/X thread (5-7 tweets)
- `newsletter` - Email newsletter (200-400 words)

#### Trends Social Poster (`trends-social-poster`)

**Trigger:** Twice daily (6am and 6pm IST)

**What it does:**
1. Fetches Google Trends data via SerpAPI
2. Fetches additional trends via Apify
3. AI picks the most relevant trending topic
4. Researches topic using Perplexity API
5. Generates social post following style guidelines
6. Posts to LinkedIn, Twitter, and Facebook
7. Logs to Google Sheets

**Why it works:** Trending topics get more engagement. The AI ensures relevance to your SaaS/design audience.

#### Slack Approval Handler (`slack-approval-handler`)

**Trigger:** Slack button click

**What it does:**
1. Receives approval action from Slack
2. Extracts variant choice (v1, v2, or v3)
3. Updates content status to "approved"
4. Triggers UTM + shortlink generation

---

### 3. PR Engine

#### PR Hook Generator (`pr-hook-generator`)

**Trigger:** Weekly on Monday at 10am IST

**What it does:**
1. Fetches shipped tasks from Sako API (last 20)
2. Fetches PostHog behavior data
3. Fetches sales objections from CRM sheet
4. Fetches Google Trends via Apify
5. Fetches TechCrunch headlines via Apify
6. AI generates 10 PR hooks based on all context
7. Parses and saves to `pr_backlog` sheet
8. Posts top 3 to `#pr-ideas` Slack channel

**PR Pillars:**
- `shipping` - "Sako shipped X in 48h" stories
- `data` - Industry insights, benchmarks
- `founder_pov` - Contrarian views, hot takes

**Risk Levels:**
- `low` - Easily provable, minimal fact-checking
- `medium` - Needs some verification
- `high` - Needs careful fact-checking before pitching

#### Earned Media Outreach (`earned-media-outreach`)

**Trigger:** When PR backlog item status = "published"

**What it does:**
1. Finds published PR hooks
2. Matches with relevant media targets
3. If journalist has LinkedIn URL:
   - Scrapes their profile via Apify
   - Gets recent activity, headline, company
4. AI generates personalized pitch using:
   - PR hook content
   - Target's audience
   - Journalist's recent coverage
5. Sends email via Resend
6. Logs send timestamp
7. Schedules D+3 follow-up

**Media Target Matching:**
- Filters targets by `audience_fit` field
- Matches keywords: SaaS, design, startup
- Limits to 10 targets per PR item

#### Coverage Tracker (`coverage-tracker`)

**Trigger:** Manual or scheduled

**What it does:**
1. Monitors media mentions via Google Alerts RSS
2. For each mention:
   - Scrapes full article via Apify
   - AI classifies sentiment (positive/neutral/negative)
   - AI extracts key quotes about Sako
3. Updates `coverage` sheet
4. Notifies `#pr-wins` for positive coverage

---

### 4. Analytics

#### Weekly Growth Report (`weekly-growth-report`)

**Trigger:** Monday at 8am IST

**What it does:**
1. Fetches GA4 data (current + previous week)
2. Fetches top pages by views
3. Fetches PostHog key events
4. Fetches Search Console keyword data
5. Aggregates all metrics
6. AI generates 3-5 key insights
7. Posts formatted report to `#sako-growth`

**Metrics tracked:**
- Sessions (WoW change)
- Users (WoW change)
- New users
- Pageviews
- Conversions (WoW change)
- Avg session duration
- Top 5 pages
- Top 10 keywords with CTR and position

---

## Google Sheets Setup

You need to create a single Google Spreadsheet with multiple sheets (tabs). Here's the structure:

### Sheet: `apollo_import`

| Column | Type | Description |
|--------|------|-------------|
| `First Name` | string | Contact first name (Apollo export) |
| `Last Name` | string | Contact last name (Apollo export) |
| `Email` | email | Contact email |
| `Title` | string | Job title |
| `Company Name` | string | Company name |
| `Industry` | string | Company industry |
| `# Employees` | number | Employee count |
| `Keywords` | string | Apollo keywords |
| `Person Linkedin Url` | URL | Person LinkedIn URL |
| `Website` | URL | Company website |

### Sheet: `qualified_leads`

| Column | Type | Description |
|--------|------|-------------|
| `first_name` | string | Contact first name |
| `last_name` | string | Contact last name |
| `email` | email | Contact email |
| `title` | string | Job title |
| `company` | string | Company name |
| `industry` | string | Industry classification |
| `employees` | number | Employee count |
| `linkedin_url` | URL | Person LinkedIn URL |
| `website` | URL | Company website |
| `icp_score` | number | ICP score (0-100) |
| `reasoning` | string | Why the lead was scored this way |
| `green_flags` | string | Positive ICP signals |
| `status` | string | `qualified` or `disqualified` |
| `scored_at` | date | When scored |
| `value_proposition` | string | AI-generated value prop |
| `target_audience` | string | Marketing, product, founders, etc. |
| `market` | string | B2B or B2C |
| `design_maturity` | string | low/medium/high |
| `design_subscription_fit` | string | yes/no with reason |
| `pain_points` | string | Semicolon-separated pain points |
| `recommended_package` | string | Core/Ops/Enterprise |
| `apollo_employee_count` | number | Apollo employee estimate |
| `apollo_linkedin_url` | URL | Company LinkedIn URL |
| `apollo_technologies` | string | Top technologies |
| `enriched` | string | `true`/`false` |
| `enriched_at` | date | When enriched |

### Sheet: `disqualified_leads`

| Column | Type | Description |
|--------|------|-------------|
| `first_name` | string | Contact first name |
| `last_name` | string | Contact last name |
| `email` | email | Contact email |
| `title` | string | Job title |
| `company` | string | Company name |
| `industry` | string | Industry classification |
| `icp_score` | number | ICP score (0-100) |
| `reasoning` | string | Why the lead was disqualified |
| `red_flags` | string | Disqualifying factors |
| `scored_at` | date | When scored |

### Sheet: `warm_opens`

| Column | Type | Description |
|--------|------|-------------|
| `email` | email | Contact email |
| `name` | string | Contact name |
| `title` | string | Job title |
| `company` | string | Company name |
| `phone` | string | Phone number |
| `linkedin_url` | URL | Person LinkedIn URL |
| `open_count` | number | Email open count |
| `last_open` | date | Most recent open |
| `campaigns` | string | Brevo campaign names |
| `call_status` | string | `pending`, `called`, `attempted`, `meeting_booked` |
| `flagged_at` | date | When added to warm opens |
| `called_at` | date | Last call date |
| `call_outcome` | string | `connected`, `voicemail`, etc. |
| `call_duration` | string | Formatted call duration |

### Sheet: `call_tracker`

| Column | Type | Description |
|--------|------|-------------|
| `call_id` | string | Quo call ID |
| `phone` | string | Dialed number |
| `email` | email | Contact email |
| `name` | string | Contact name |
| `company` | string | Company name |
| `duration` | string | Formatted duration |
| `outcome` | string | Call outcome |
| `called_at` | date | Call timestamp |
| `needs_followup` | boolean | Whether follow-up is needed |

### Sheet: `hiring_signals`

| Column | Type | Description |
|--------|------|-------------|
| `job_title` | string | Role being hired |
| `company` | string | Company name |
| `location` | string | Job location |
| `posted_at` | date | When the job was posted |
| `job_url` | URL | Job posting link |
| `company_url` | URL | Company website or LinkedIn URL |
| `company_domain` | string | Domain extracted from company URL |
| `contact_name` | string | Hiring contact name if found |
| `contact_email` | email | Hiring contact email if found |
| `source` | string | `linkedin_hiring_signal` |
| `captured_at` | date | When the signal was captured |

### Sheet: `content_backlog`

| Column | Type | Description |
|--------|------|-------------|
| `id` | string | Unique ID (e.g., `cb_001`) |
| `pillar` | string | Content pillar (`teardown`, `tips`, etc.) |
| `hook` | string | Content hook/topic |
| `format` | string | `LI`, `X`, or `newsletter` |
| `draft_text` | string | AI-generated draft |
| `final_text` | string | Approved final version |
| `status` | string | `queued` → `needs_approval` → `approved` → `published` |
| `publish_at` | date | Scheduled publish time |
| `post_urls` | string | Published post URLs (comma-separated) |
| `created_at` | date | When added to backlog |

### Sheet: `pr_backlog`

| Column | Type | Description |
|--------|------|-------------|
| `id` | string | Unique ID (e.g., `pr_001`) |
| `hook` | string | PR hook sentence |
| `pillar` | string | `shipping`, `data`, or `founder_pov` |
| `proof_links` | JSON | Links to supporting evidence |
| `status` | string | `queued` → `approved` → `published` → `pitched` |
| `risk_level` | string | `low`, `medium`, or `high` |

### Sheet: `media_targets`

| Column | Type | Description |
|--------|------|-------------|
| `outlet_name` | string | Publication/podcast name |
| `contact` | email | Journalist/host email |
| `format` | string | `podcast`, `article`, `newsletter` |
| `audience_fit` | string | Why they're relevant to Sako |
| `linkedin_url` | URL | LinkedIn profile for personalization |
| `last_pitched_at` | date | Last outreach date (avoid spamming) |

### Sheet: `coverage`

| Column | Type | Description |
|--------|------|-------------|
| `url` | URL | Article URL |
| `outlet` | string | Publication name |
| `author` | string | Author name |
| `published_at` | date | Publication date |
| `sentiment` | string | `positive`, `neutral`, `negative` |
| `quotes` | string | Key quotes about Sako |
| `tracked_at` | date | When we found it |

### Sheet: `suppression_list`

| Column | Type | Description |
|--------|------|-------------|
| `email` | email | Email to suppress |
| `reason` | string | `unsubscribed`, `bounced`, `complained` |
| `added_at` | date | When added |

### Sheet: `idempotency_log`

| Column | Type | Description |
|--------|------|-------------|
| `external_event_id` | string | Cal.com/Calendly event ID |
| `processed_at` | date | When processed |
| `workflow` | string | Which workflow processed it |

### Sheet: `campaign_links`

| Column | Type | Description |
|--------|------|-------------|
| `campaign_name` | string | UTM campaign name |
| `original_url` | URL | Base URL |
| `utm_url` | URL | Full UTM-tagged URL |
| `short_url` | URL | Shortened URL |
| `created_at` | date | When created |

### Sheet: `journalist_profiles`

| Column | Type | Description |
|--------|------|-------------|
| `name` | string | Full name |
| `outlet` | string | Primary publication |
| `email` | email | Contact email |
| `linkedin_url` | URL | LinkedIn profile |
| `beats` | string | Topics they cover |
| `last_scraped_at` | date | Last profile update |
| `recent_articles` | string | Recent article titles |

### Sheet: `industry_news`

| Column | Type | Description |
|--------|------|-------------|
| `title` | string | Headline |
| `url` | URL | Article URL |
| `source` | string | TechCrunch, etc. |
| `published_at` | date | Publication date |
| `relevance_score` | number | AI-assigned relevance (0-100) |

---

## Slack Channels

Create these Slack channels:

| Channel | Purpose | Volume |
|---------|---------|--------|
| `#sako-leads` | High-intent lead notifications | 1-5/day |
| `#content-review` | Content approval requests | 1/day |
| `#pr-ideas` | Weekly PR hook ideas | 1/week |
| `#pr-wins` | Media coverage celebrations | As earned |
| `#sako-growth` | Weekly growth report | 1/week |
| `#n8n-errors` | Workflow errors | Hopefully 0 |
| `#sako-alerts` | Critical system alerts | Rare |

### Slack App Setup

1. Create a Slack app at [api.slack.com](https://api.slack.com)
2. Add OAuth scopes:
   - `chat:write`
   - `chat:write.public`
3. Install to workspace
4. Save Bot Token as `SLACK_BOT_TOKEN` in n8n credentials

---

## Cost Management

### Monthly Cost Breakdown

| Service | Free Tier | Est. Monthly Cost |
|---------|-----------|-------------------|
| **n8n (Railway)** | - | ~$5-10 |
| **PostgreSQL (Railway)** | - | Included |
| **Redis (Railway)** | - | Included |
| **Apify** | $5/month | $0 (free tier) |
| **OpenAI (GPT-5.2)** | - | ~$10-20 |
| **Resend** | 3,000 emails/month | $0 (free tier) |
| **SerpAPI** | 100 searches/month | $0 (free tier) |
| **Perplexity** | - | ~$5 |
| **Clearbit** | - | ~$0 (limited free) |
| **Total** | | **~$20-35/month** |

### Apify Credit Management

With $5/month free tier:

| Actor | Cost | Monthly Usage | Est. Cost |
|-------|------|---------------|-----------|
| Contact Scraper | ~$0.01/site | 200 sites | $2.00 |
| Google Trends | ~$0.01/query | 50 queries | $0.50 |
| TechCrunch | ~$0.05/run | 4 runs | $0.20 |
| LinkedIn Profiles | ~$0.02/profile | 50 profiles | $1.00 |
| Article Extractor | ~$0.01/article | 50 articles | $0.50 |
| **Total** | | | **~$4.20** |

**Tips to stay under budget:**
- Workflows cache results in Google Sheets
- Only scrape new contacts (check before scraping)
- Limit LinkedIn scraping to high-value targets

### OpenAI Cost Management

GPT-5.2 is used for:
- Content generation (~3 calls/day)
- PR hook generation (~1 call/week)
- Lead scoring summaries (~5 calls/day)
- Growth report insights (~1 call/week)

**Estimated tokens:** ~50,000/month = ~$15-20

---

## Monitoring & Troubleshooting

### Health Checks

**Daily automated checks:**
- All workflows have `error-handler` configured
- Failed executions trigger Slack alerts
- Critical workflows page `#sako-alerts`

**Critical workflows** (failures page immediately):
- `lead-intake-router` - You'll miss leads
- `handle-email-events` - Deliverability issues
- `backup-workflows` - Data loss risk

### Common Issues

#### 1. Webhooks showing localhost URLs

**Symptom:** Webhook URLs in n8n show `http://localhost:5678/...`

**Fix:** Verify environment variables:
```bash
WEBHOOK_URL=https://n8n.sako.agency/
N8N_PROXY_HOPS=1
N8N_EXPRESS_TRUST_PROXY=true
```

#### 2. Google Sheets "not found"

**Symptom:** `Sheet not found` errors

**Fix:**
1. Open the Google Sheet
2. Copy the Sheet ID from URL
3. Update workflow with correct Sheet ID
4. Ensure service account has Editor access

#### 3. Apify "insufficient credits"

**Symptom:** Apify actors fail to run

**Fix:**
1. Check credits at [apify.com/console](https://console.apify.com)
2. Wait for monthly reset (1st of month)
3. Or reduce `dataset_limit` in workflows

#### 4. Slack messages not posting

**Symptom:** Slack nodes fail silently

**Fix:**
1. Check OAuth token hasn't expired
2. Verify bot is in the target channel
3. Re-authenticate Slack credential in n8n

#### 5. Email deliverability issues

**Symptom:** Emails bouncing or going to spam

**Fix:**
1. Verify DNS records are set:
   - SPF: `v=spf1 include:_spf.resend.com ~all`
   - DKIM: Check Resend dashboard
   - DMARC: `v=DMARC1; p=quarantine`
2. Check suppression list is up-to-date
3. Review `handle-email-events` for bounce/complaint patterns

### Viewing Execution Logs

1. Go to `https://n8n.sako.agency`
2. Login with basic auth credentials
3. Click on workflow
4. Click "Executions" tab
5. Click specific execution to see node-by-node data

### Emergency Procedures

**If lead capture is broken:**
1. Check `#n8n-errors` for error details
2. Manually log leads from Cal.com/Calendly dashboard
3. Run `company-enrichment` manually on missed leads

**If content isn't posting:**
1. Manually post approved content
2. Check `content_backlog` status + final text
3. Re-run `utm-link-generator` if the link is missing

**If PR outreach sent bad emails:**
1. Immediately pause `earned-media-outreach` workflow
2. Check Resend dashboard for sent emails
3. Send manual apology if needed
4. Review and fix the pitch template

---

## Extending the System

### Adding a New Content Pillar

1. Update `content_backlog` with new pillar value
2. Edit `content-generator` workflow
3. Add pillar-specific guidelines in the AI prompt
4. Test with a manual execution

### Adding a New Social Platform

1. Create credentials in n8n for the platform
2. Copy existing posting node (e.g., from `trends-social-poster`)
3. Add to workflow after approval step
4. Update Google Sheet tracking columns

### Adding a New Data Enrichment Source

1. Find Apify actor for the data source
2. Test actor in Apify console
3. Create new workflow using `apify-runner` pattern:
   ```javascript
   {
     "actor_id": "username/actor-name",
     "run_input": { /* actor-specific input */ },
     "dataset_limit": 10
   }
   ```
4. Add normalization code for the actor's output format

### Creating a New Weekly Report

1. Copy `weekly-growth-report` workflow
2. Modify data sources (API calls)
3. Update aggregation logic
4. Customize AI summary prompt
5. Update Slack message format

---

## Quick Reference

### Environment Variables

```bash
# Core
N8N_ENCRYPTION_KEY=<32-char-key>
# Auth is via built-in User Management (owner setup on first launch).
# N8N_BASIC_AUTH_* was removed in n8n 1.0 — do not use.

# APIs
APIFY_API_TOKEN=<from-apify-console>
OPENAI_API_KEY=<from-openai>
SAKO_API_URL=https://api.trysako.com
SAKO_API_KEY=<your-api-key>

# Google
GA4_PROPERTY_ID=<your-ga4-property>
POSTHOG_API_URL=https://app.posthog.com
POSTHOG_PROJECT_ID=<your-project-id>
SEARCH_CONSOLE_SITE=https://trysako.com
```

### Key URLs

| Service | URL |
|---------|-----|
| n8n Editor | https://n8n.sako.agency |
| Railway Dashboard | https://railway.app/project/xxx |
| Apify Console | https://console.apify.com |
| Google Sheets | https://docs.google.com/spreadsheets/d/xxx |
| Resend Dashboard | https://resend.com/overview |

### Workflow Quick Actions

| Task | Workflow | How to Trigger |
|------|----------|----------------|
| Enrich a company list | `company-enrichment` | Manual execute |
| Generate content now | `content-generator` | Manual execute |
| Check lead scoring | `lead-intake-router` | View recent executions |
| Generate PR hooks early | `pr-hook-generator` | Manual execute |
| Run growth report | `weekly-growth-report` | Manual execute |

---

## Support

This system is designed to run autonomously. If something breaks:

1. Check `#n8n-errors` in Slack
2. Review execution logs in n8n
3. Check this documentation
4. Ask AI (Claude/GPT) for help debugging

Remember: The goal is **minimum viable marketing**—enough automation to keep the growth engine running while you focus on delivering great design work.

---

*Last updated: Feb 2026*
*Version: 1.0*
