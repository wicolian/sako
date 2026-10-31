# Sako Automations - Cheat Sheet

> **One-page reference for daily operations**

---

## Daily Routine (5 min)

| Time | Action | Where |
|------|--------|-------|
| 9:15 AM | Approve content | `#content-review` Slack |
| Any time | Check new leads | `#sako-leads` Slack |
| Any time | Check errors | `#n8n-errors` Slack |

---

## Weekly (Monday)

| Time | What | Action |
|------|------|--------|
| 8:00 AM | Growth report arrives | Review in `#sako-growth` |
| 10:00 AM | PR hooks arrive | Review in `#pr-ideas` |
| 10:30 AM | Mark best PR hooks | Status → "approved" in sheet |

---

## Google Sheets

**Main Spreadsheet Tabs:**

| Sheet | Purpose |
|-------|---------|
| `content_backlog` | Content queue (add ideas here) |
| `pr_backlog` | PR hooks (auto-generated) |
| `media_targets` | Journalists to pitch |
| `suppression_list` | Emails to never contact |

---

## Content Status Flow

```
queued → needs_approval → approved → published
```

---

## Lead Scoring

| Score | Meaning | Slack |
|-------|---------|-------|
| 70+ | High intent | Notified |
| < 70 | Normal | Not notified |

---

## PR Status Flow

```
queued → approved → published → pitched
```

Change to "published" → triggers outreach

---

## Quick Actions

**Add content idea:**
1. Open `content_backlog` sheet
2. Add row with status = `queued`

**Approve content:**
1. Click approve button in Slack
2. Or: Change sheet status to `approved`

**Trigger PR outreach:**
1. Change PR hook status to `published`

**Block an email:**
1. Add to `suppression_list` sheet

---

## If Something's Broken

1. Check `#n8n-errors`
2. Go to https://n8n.sako.agency
3. Find workflow → Executions
4. Click failed execution → see error

---

## Monthly Costs

| Service | Cost |
|---------|------|
| Railway | ~$5-10 |
| OpenAI | ~$10-20 |
| Apify | Free |
| Resend | Free |
| **Total** | **~$20-35** |

---

## Key URLs

- **n8n:** https://n8n.sako.agency
- **Railway:** https://railway.app
- **Apify:** https://console.apify.com
- **Resend:** https://resend.com

---

## Emergency Contacts

**If leads aren't capturing:**
→ Check Cal.com webhook settings

**If nothing works:**
→ Check Railway deployment status

---

*Print this. Keep it handy.*
