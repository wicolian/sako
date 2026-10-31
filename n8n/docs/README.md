# Sako Marketing Automations - Documentation

> **Your AI-powered marketing team, documented**

This documentation is written for solo founders and small teams running Sako's marketing automations without a dedicated ops team.

---

## Documentation Index

### For Getting Started

| Document | Description | Time to Read |
|----------|-------------|--------------|
| [Quick Start](./QUICK_START.md) | First-time setup guide | 15 min |
| [User Guide](./USER_GUIDE.md) | Complete system documentation | 30 min |

### For Daily Operations

| Document | Description | Time to Read |
|----------|-------------|--------------|
| [Operations Runbook](./OPERATIONS_RUNBOOK.md) | Day-to-day procedures & incident response | 20 min |

---

## Quick Reference

### What Runs Automatically

| Time | Workflow | What It Does |
|------|----------|--------------|
| On booking | Lead Intake Router | Captures, enriches, scores, notifies |
| Daily 9am | Content Generator | Creates content, requests approval |
| Twice daily | Trends Social Poster | Posts trending content to socials |
| Monday 8am | Weekly Growth Report | Sends analytics summary |
| Monday 10am | PR Hook Generator | Creates 10 PR hooks |
| On PR publish | Earned Media Outreach | Sends personalized pitches |
| On email event | Handle Email Events | Updates suppression list |
| On any error | Error Handler | Alerts `#n8n-errors` |

### Your Daily Tasks

1. **9:15 AM** - Check `#content-review`, approve content
2. **Throughout day** - Check `#sako-leads` for high-intent leads
3. **Monday 10:15 AM** - Review growth report, mark best PR hooks

### Cost Summary

| Service | Monthly Cost |
|---------|--------------|
| Railway (n8n + DBs) | ~$5-10 |
| OpenAI API | ~$10-20 |
| Apify | Free ($5 credit) |
| Resend | Free (3k emails) |
| **Total** | **~$20-35** |

---

## Need Help?

1. Check [Operations Runbook](./OPERATIONS_RUNBOOK.md) for common issues
2. Review workflow executions in n8n for errors
3. Check `#n8n-errors` Slack channel
4. Ask AI (Claude/GPT) with error messages

---

*Built for Sako - trysako.com*
