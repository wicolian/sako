# Deployment Checklist (n8n Sako)

Use this checklist to deploy the workflows in the correct order and verify each step.

## 1. Core Infrastructure

- [ ] Import `workflows/_shared/apify-runner.json`
- [ ] Import `workflows/_shared/error-handler.json`
- [ ] Import `workflows/_shared/webhook-auth.json`
- [ ] Configure credentials in n8n:
  - [ ] `APIFY_API_TOKEN`
  - [ ] Slack OAuth
  - [ ] OpenAI API
  - [ ] Google Sheets OAuth
- [ ] Create Slack channel `#n8n-errors`

## 2. Google Sheets (One Spreadsheet)

Create these tabs using templates in `templates/`:

- `apollo_import`
- `qualified_leads`
- `disqualified_leads`
- `warm_opens`
- `call_tracker`
- `suppression_list`
- `idempotency_log`
- `content_backlog`
- `hiring_signals`

## 3. Slack Channels

Create these channels:

- `#sako-leads`
- `#content-review`
- `#n8n-errors`
- `#signals`
- `#pr-ideas`
- `#sako-growth`

## 4. Outbound Workflows (Order Matters)

- [ ] `workflows/leads/apollo-icp-qualifier.json`
- [ ] `workflows/leads/company-enrichment.json`
- [ ] `workflows/leads/brevo-warm-opens.json`
- [ ] `workflows/leads/mark-called-handler.json`
- [ ] `workflows/leads/call-prep-brief.json`
- [ ] `workflows/leads/quo-call-logger.json`
- [ ] `workflows/leads/linkedin-hiring-signal-monitor.json`

## 5. Inbound Workflows

- [ ] `workflows/leads/lead-intake-router.json`
- [ ] `workflows/leads/handle-email-events.json`

## 6. Content Workflows

- [ ] `workflows/content/content-generator.json`
- [ ] `workflows/content/slack-approval-handler.json`
- [ ] `workflows/content/trends-social-poster.json`

## 7. Sync workflows to production (optional)

After deploy, to push the repo’s workflow JSONs to n8n without creating duplicates:

- Create an API key in n8n: **Settings → n8n API → Create API key**
- Set `N8N_BASE_URL` and `N8N_API_KEY` (e.g. in Railway or `.env`)
- Run: `node scripts/sync-workflows.mjs` (or `railway run node scripts/sync-workflows.mjs`)

Workflows are synced in the order from this doc; existing ones are updated, new ones created.

## 8. Verification (Run Once)

- [ ] `apollo-icp-qualifier` — upload 5 test contacts, verify scoring
- [ ] `brevo-warm-opens` — manual run, confirm Slack post + warm_opens sheet
- [ ] `mark-called-handler` — click Slack button, confirm sheet update
- [ ] `call-prep-brief` — generate a brief, confirm output
- [ ] `lead-intake-router` — send test webhook, confirm Slack post if high intent
- [ ] `content-generator` — add one queued item, confirm 3 variants in Slack
- [ ] `trends-social-poster` — manual run, confirm post + sheet log
- [ ] `linkedin-hiring-signal-monitor` — manual run, confirm hiring_signals entries
