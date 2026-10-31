# Recommended Apify Actors for Sako

Based on your workflows and free tier budget ($5/month), here are the most valuable actors:

## 🎯 High Priority (Immediate Value)

### 1. **X/Twitter Trends Scraper** (`fastcrawler/x-twitter-trends-scraper-2025`)
- **Cost:** $0.01 per 1,000 results (extremely cheap!)
- **Use Case:** Add to `trends-social-poster.json` and `pr-hook-generator.json`
- **Value:** Real-time Twitter trends complement Google Trends for content/PR hooks
- **Monthly Budget:** ~$0.10 for 10,000 trend queries
- **Why:** Twitter trends often precede Google Trends, giving you early signals

### 2. **Google News Scraper** (`epctex/google-news-scraper`)
- **Cost:** Pay-per-use (check pricing)
- **Use Case:** Add to `pr-hook-generator.json` alongside TechCrunch
- **Value:** Broader news coverage than TechCrunch alone
- **Why:** TechCrunch is tech-focused; Google News covers broader SaaS/design industry news

### 3. **EmailListVerify** (`emaillistverify/emaillistverify`)
- **Cost:** Check pricing
- **Use Case:** Add to `earned-media-outreach.json` before sending emails
- **Value:** Verify journalist emails before outreach (prevents bounces, improves deliverability)
- **Why:** Reduces email bounces, improves sender reputation

### 4. **LinkedIn Company Insights Scraper** (`bestscrapers/linkedin-company-insights-scraper`)
- **Cost:** Pay-per-use
- **Use Case:** Enhance `company-enrichment.json` and `call-prep-brief.json`
- **Value:** Headcount growth, hiring patterns, employee analytics
- **Why:** Better company intelligence than Clearbit alone (shows growth signals)

## 🚀 Medium Priority (Strategic Value)

### 5. **LinkedIn Jobs Scraper** (`vbartonicek/linkedin-jobs-scraper`)
- **Cost:** Pay-per-use
- **Use Case:** New workflow: `linkedin-hiring-signal-monitor`
- **Value:** Finds companies actively hiring designers (strong budget signal)
- **Why:** Hiring intent = warm outbound targets for Sako

### 6. **Reddit Scraper** (`harshmaur/reddit-scraper`)
- **Cost:** Pay-per-result model
- **Use Case:** New workflow: Monitor Reddit for Sako mentions, competitor discussions
- **Value:** Community sentiment, PR opportunities, competitor intelligence
- **Why:** Reddit is where SaaS founders discuss pain points (great for PR hooks)

### 7. **Content Checker** (`jakubbalada/content-checker`)
- **Cost:** Check pricing
- **Use Case:** Monitor competitor websites for design changes, feature launches
- **Value:** Competitive intelligence, PR opportunities when competitors launch
- **Why:** Helps with "news-jacking" PR hooks

### 8. **LinkedIn Leads Generator** (`caprolok/linkedin-leads-generator`)
- **Cost:** Pay-per-use
- **Use Case:** Build `apollo_import` (sales prospects) and `candidate_pipeline` (design hires)
- **Value:** Auto-discover decision makers and designer candidates by title/skills
- **Why:** Reduces manual sourcing for outreach and recruiting

### 9. **LinkedIn Profile Scraper** (`harvestapi/linkedin-profile-scraper`)
- **Cost:** Pay-per-use
- **Use Case:** Personalization signals for `linkedin-inmail-generator` and recruiting screening
- **Value:** Pulls recent activity, headlines, company context
- **Why:** Enables high-personalization for InMails and better candidate screening

### 10. **BuiltWith** (`canadesk/builtwith-bulk`)
- **Cost:** Check pricing
- **Use Case:** Enhance `company-enrichment.json` - identify tech stack
- **Value:** Know what tools companies use (helps with personalization)
- **Why:** "We see you use [tool]" is powerful personalization

## 💡 Nice to Have (Future Expansion)

### 11. **Instagram Leads Generator** (`caprolok/instagram-leads-generator`)
- **Use Case:** Find design influencers for partnerships
- **Value:** Expand beyond LinkedIn for influencer outreach

### 12. **Website Contact & Socials Extractor** (`embion/website-contact-socials-extractor`)
- **Use Case:** Alternative to current contact scraper (might be better)
- **Value:** 2-hour trial available to test

## ❌ Skip These (Not Relevant)

- **TikTok/Instagram scrapers** - Not relevant for B2B SaaS
- **Zillow/Airbnb/TripAdvisor** - Wrong industry
- **Facebook Ad Library** - Not needed for current workflows
- **Hotel Review Aggregator** - Wrong industry

## Implementation Priority

1. **Week 1:** X/Twitter Trends + Google News (easy wins, cheap)
2. **Week 2:** EmailListVerify + LinkedIn Jobs Scraper (deliverability + warm signals)
3. **Week 3:** LinkedIn Company Insights (better enrichment)
4. **Week 4:** Reddit Scraper (new workflow opportunity)

## Cost Estimate (Free Tier $5/month)

| Actor | Monthly Usage | Est. Cost |
|-------|--------------|-----------|
| X/Twitter Trends | 10K queries | $0.10 |
| Google News | 100 articles | $0.50 |
| EmailListVerify | 200 emails | $0.50 |
| LinkedIn Jobs Scraper | 50 listings | varies |
| LinkedIn Company Insights | 50 companies | $1.00 |
| Reddit Scraper | 500 posts | $0.50 |
| **Total** | | **~$2.60** |
| **Contingency** | | **$2.40** |

This leaves $2.40 buffer for unexpected usage or additional actors.

## Sales + Recruiting Budget Allocation (current priority)

| Actor | Monthly Usage | Est. Cost |
|-------|--------------|-----------|
| LinkedIn Leads Generator | 100 prospects + 30 candidates | $1.30 |
| LinkedIn Profile Scraper | 80 profiles | $0.80 |
| LinkedIn Company Insights | 50 companies | $1.00 |
| EmailListVerify | 100 emails | $0.50 |
| **Total** | | **~$3.60** |
| **Contingency** | | **$1.40** |

## Quick Integration Guide

All actors can be integrated using the existing `apify-runner` workflow:

```json
{
  "actor_id": "fastcrawler/x-twitter-trends-scraper-2025",
  "run_input": {
    "country": "US",
    "limit": 20
  },
  "dataset_limit": 20
}
```

Then normalize the output and merge with existing data sources.
