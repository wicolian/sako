# Operations Runbook - Sako Marketing Automations

> **Day-to-day procedures for running your AI marketing engine**

---

## Daily Checklist (5 minutes)

### Morning (9:15 AM IST)

- [ ] **Check `#content-review`**
  - Review AI-generated content variants
  - Approve best variant or reject all
  - Approved content gets a tracking link added

- [ ] **Check `#sako-leads`**
  - Note any high-intent leads (70+ score)
  - Review enrichment data before calls
  - Follow up on bookings for today
  - Flag any hiring signals for outreach planning

- [ ] **Check `#n8n-errors`**
  - If empty → all systems operational
  - If alerts → see [Incident Response](#incident-response)

### End of Day

- [ ] Review `content_backlog` sheet
  - Add new content ideas if backlog < 5 items
  - Mark published content as "published"
  - Add post URLs for tracking

---

## Weekly Checklist

### Monday

| Time | Task | Channel |
|------|------|---------|
| 8:00 AM | Growth report auto-posts | `#sako-growth` |
| 10:00 AM | PR hooks auto-generated | `#pr-ideas` |
| 10:15 AM | **Review growth report** | Manual |
| 10:30 AM | **Review PR hooks, mark best as "approved"** | Manual |

### Friday

- [ ] Review week's content performance
- [ ] Update `media_targets` with new journalists found
- [ ] Archive completed PR items in `pr_backlog`
- [ ] Check Apify credits remaining
- [ ] Review `hiring_signals` for new warm leads

---

## Monthly Checklist

### First Week

- [ ] **Apify credits reset** (1st of month)
  - Check [apify.com/console](https://console.apify.com)
  - Review which actors used most credits
  - Adjust `dataset_limit` if needed

- [ ] **Review email deliverability**
  - Check Resend dashboard for bounce rates
  - Review `suppression_list` for patterns
  - Verify DNS records still valid

### Mid-Month

- [ ] **Archive old data**
  - Move published content older than 30 days
  - Move completed PR items older than 30 days
  - Export to archive sheet if needed

- [ ] **Review workflow metrics**
  - Execute `metrics-reporter` manually
  - Check success rates per workflow
  - Investigate any < 90% success rate

### End of Month

- [ ] **Cost review**
  - Check Railway usage
  - Check OpenAI API costs
  - Optimize if over budget

---

## Workflow Operations

### How to Queue New Content

1. Open Google Sheets → `content_backlog`
2. Add new row:
   ```
   id: cb_XXX (increment from last)
   pillar: teardown | tips | case_study | industry | founder_pov
   hook: "Your content idea/topic"
   format: LI | X | newsletter
   status: queued
   created_at: today's date
   ```
3. Content Generator will pick it up at next 9am run
4. Or manually execute workflow for immediate generation

### How to Approve Content

**Via Slack (recommended):**
1. Find message in `#content-review`
2. Review all 3 variants
3. Click "Approve Variant 1", "Approve Variant 2", or "Approve Variant 3"
4. Or click "Reject" to regenerate tomorrow

**Via Google Sheets (fallback):**
1. Open `content_backlog` sheet
2. Find row with status "needs_approval"
3. Copy best variant from `draft_text` to `final_text`
4. Change status to "approved"
5. Manually post approved content (or use your scheduler)

### How to Trigger PR Outreach

1. Open `pr_backlog` sheet
2. Find approved hook to pitch
3. Change status to "published"
4. `earned-media-outreach` will auto-trigger
5. Review sent pitches in Resend dashboard

### How to Add a New Lead Source

If leads come from a new source (not Cal.com/Calendly):

1. Add new webhook trigger to `lead-intake-router`
2. Add signature verification code
3. Add normalization for new payload format
4. Test with sample webhook
5. Activate workflow

### How to Pause a Workflow

**Temporarily (for debugging):**
1. Open workflow in n8n
2. Click toggle to deactivate
3. Debug/fix
4. Re-activate

**Permanently (deprecated):**
1. Deactivate workflow
2. Move JSON to `workflows/_archived/`
3. Delete from n8n

---

## Incident Response

### Severity Levels

| Level | Description | Response Time | Example |
|-------|-------------|---------------|---------|
| **P1** | Revenue/lead capture broken | Immediate | Lead router down |
| **P2** | Important automation broken | Same day | Content not posting |
| **P3** | Nice-to-have broken | This week | PR tracker issues |

### P1: Lead Capture Down

**Symptoms:**
- No new leads in `#sako-leads`
- Errors in `#n8n-errors` from `lead-intake-router`
- Bookings happening but not captured

**Response:**
1. Check workflow status in n8n
2. Check recent executions for error details
3. Test webhook manually:
   ```bash
   curl -X POST https://n8n.sako.agency/webhook/calcom-booking \
     -H "Content-Type: application/json" \
     -d '{"test": true}'
   ```
4. If webhook unreachable:
   - Check Railway deployment status
   - Check domain DNS
5. If execution failing:
   - Check Clearbit/Apify credentials
   - Check Google Sheets access
6. **While fixing:** Manually log leads from Cal.com dashboard

### P2: Content Not Posting

**Symptoms:**
- `#content-review` not receiving messages
- Content stuck in "queued" status

**Response:**
1. Check `content-generator` executions
2. Common issues:
   - No items with "queued" status → add content to backlog
   - OpenAI API error → check API key/credits
   - Slack error → re-authenticate Slack credential
3. **While fixing:** Manually post content from Google Sheet

### P3: PR Workflow Issues

**Symptoms:**
- No PR hooks on Monday
- Outreach emails not sending
- Coverage not being tracked

**Response:**
1. Check specific workflow executions
2. Common issues:
   - Apify credits exhausted → wait for reset or upgrade
   - API rate limits → reduce frequency
   - Sheet column mismatch → verify column names
3. These are non-critical; can wait for fix

### Error Message Reference

| Error | Likely Cause | Fix |
|-------|--------------|-----|
| `CALCOM_WEBHOOK_SECRET not configured` | Missing env var | Add to Railway variables |
| `Invalid Cal.com webhook signature` | Wrong secret | Regenerate in Cal.com |
| `Sheet not found` | Wrong Sheet ID | Update in workflow |
| `insufficient credits` | Apify out of credits | Wait for reset |
| `rate_limit_exceeded` | OpenAI throttling | Reduce frequency |
| `invalid_auth` | Expired credential | Re-authenticate |

---

## Common Tasks

### Regenerate Content for Specific Topic

1. Open `content_backlog` sheet
2. Find the row
3. Clear `draft_text` column
4. Change status back to "queued"
5. Wait for 9am or manually execute `content-generator`

### Add Someone to Suppression List

1. Open `suppression_list` sheet
2. Add row:
   ```
   email: person@example.com
   reason: manual | unsubscribed | bounced | complained
   added_at: today's date
   ```
3. They'll be skipped in all future workflows

### Force Lead Re-Enrichment

1. Find lead in your CRM/Sako API
2. Delete from `idempotency_log` sheet
3. Trigger webhook again (re-book or test)
4. Lead will be re-processed and re-enriched

### Run Growth Report Mid-Week

1. Open `weekly-growth-report` workflow
2. Click "Execute Workflow" button
3. Check `#sako-growth` for report

### Test Apify Actor

1. Open `apify-runner` workflow
2. Click "Execute Workflow"
3. Provide test input:
   ```json
   {
     "actor_id": "harvestapi/linkedin-profile-scraper",
     "run_input": {
       "profileUrls": ["https://linkedin.com/in/someone"],
       "maxItems": 1
     },
     "dataset_limit": 1
   }
   ```
4. Check output in execution

---

## Backup & Recovery

### Automatic Backups

`backup-workflows` runs daily and saves:
- All workflow JSON to S3/R2
- Execution history summary
- Credential list (encrypted)

### Manual Backup

```bash
# Export all workflows
cd workflows/
for file in */*.json; do
  echo "Backed up: $file"
done

# Commit to Git
git add .
git commit -m "Manual backup $(date)"
git push
```

### Recovery from Backup

1. If workflow deleted:
   - Import from `workflows/` folder or S3 backup
   - Reconfigure credentials
   - Activate

2. If data lost:
   - Check Google Sheets version history
   - Restore from S3 backup if using

3. If n8n database corrupted:
   - Deploy fresh instance
   - Import all workflow JSONs
   - Reconfigure credentials
   - Re-point webhooks

---

## Performance Tuning

### Slow Workflow Executions

**Symptoms:** Workflows timing out or taking > 60s

**Solutions:**
1. Reduce Apify `dataset_limit`
2. Add caching (check sheet before scraping)
3. Split into smaller workflows
4. Increase Railway compute resources

### High Apify Credit Usage

**Solutions:**
1. Cache results in Google Sheets
2. Check before scraping:
   ```javascript
   const existing = await googleSheets.read({ email });
   if (existing.length > 0) return existing[0];
   // Only scrape if not cached
   ```
3. Reduce `dataset_limit`
4. Use cheaper actors

### OpenAI Costs Too High

**Solutions:**
1. Switch some tasks to GPT-5.2 (smaller model)
2. Reduce `maxTokens` in prompts
3. Cache common generations
4. Batch similar requests

---

## Scaling Guide

### Current Capacity

With default setup:
- ~50 leads/day
- ~5 content pieces/day
- ~10 PR outreach/week
- ~100 enrichments/month (Apify free tier)

### If You Need More

**More leads:**
- No changes needed (webhook-based)

**More content:**
- Run `content-generator` multiple times/day
- Add more items to backlog

**More PR outreach:**
- Increase `media_targets` list
- Run `earned-media-outreach` manually

**More enrichment:**
- Upgrade Apify plan ($49/month)
- Add second enrichment source

---

## Contacts & Resources

### Quick Links

| Resource | URL |
|----------|-----|
| n8n Editor | https://n8n.sako.agency |
| Railway Dashboard | https://railway.app |
| Apify Console | https://console.apify.com |
| Resend Dashboard | https://resend.com |
| Google Sheets | [Your spreadsheet URL] |

### Documentation

- [User Guide](./USER_GUIDE.md) - Complete system documentation
- [Quick Start](./QUICK_START.md) - Initial setup guide
- [n8n Docs](https://docs.n8n.io) - n8n official documentation
- [Apify Docs](https://docs.apify.com) - Apify actor documentation

---

*Last updated: Feb 2026*
