# Leadfeeder API Integration

Full Leadfeeder API integration for fetching leads, custom feeds, and syncing to Brevo.

## Free vs Trial vs Premium

| Plan | API | Data | Updates |
|------|-----|------|---------|
| **Free** | ❌ No API | Last 7 days, max 100 companies | Every 24h |
| **Trial** (12–14 days) | ✅ Full API | Full access | Hourly |
| **Premium** | ✅ Full API | Full access | Hourly |

**Important:** The API requires a Trial or Premium account. If you're on the free plan, you get no API access. Use your 12-day trial to test the full integration.

---

## Setup

### 1. API Token

1. In Leadfeeder/Dealfront: **Settings** → **API** → Generate token
2. Add to `.env.local`:

```env
LEADFEEDER_API_TOKEN=your_token_here
```

### 2. Brevo List (for sync)

Create the "Sako Leadfeeder Visitors" list:

```bash
# If you haven't run Brevo setup yet:
pnpm run setup:brevo

# If you already have newsletter/demo lists:
node scripts/add-leadfeeder-brevo-list.mjs
```

Add the list ID to `.env.local`:

```env
BREVO_LEADFEEDER_LIST_ID=13
```

---

## Usage

### Fetch leads (verify API works)

```bash
pnpm run leadfeeder:fetch
# Lists accounts, tracker status

pnpm run leadfeeder:fetch -- --leads
# Last 7 days of leads

pnpm run leadfeeder:fetch -- --leads --days 14
# Last 14 days

pnpm run leadfeeder:fetch -- --feeds
# List custom feeds
```

### Export to JSON

The `--leads` command writes `leadfeeder-leads-YYYY-MM-DD-YYYY-MM-DD.json` to the project root.

### Sync to Brevo

Creates Brevo contacts for high-intent companies (quality ≥ 5). Uses `contact@domain.com` as placeholder email.

```bash
# Dry run (default)
pnpm run leadfeeder:sync

# Actual sync
pnpm run leadfeeder:sync -- --sync

# Options
pnpm run leadfeeder:sync -- --sync --days 14 --min-quality 6
```

**⚠️ Warning:** Sync contacts have placeholder emails. Do NOT add them to marketing automations. Use for CRM tracking only. Filter by `LEADFEEDER_SYNC=true` in Brevo.

---

## API Client (src/lib/leadfeeder.ts)

Use in Next.js API routes or server code:

```ts
import {
  getAccounts,
  getLeads,
  getCustomFeeds,
  getLeadVisits,
} from '@/lib/leadfeeder';

// Get accounts
const accounts = await getAccounts();

// Get leads for date range
const { leads } = await getLeads(accountId, '2025-02-01', '2025-02-12');

// Get leads for a custom feed
const { leads } = await getLeads(accountId, start, end, {
  customFeedId: 'recommended_leads',
});

// Get visits for a lead
const visits = await getLeadVisits(accountId, leadId, start, end);
```

---

## Rate Limits

- **100 requests/minute** per token (or per account for account-scoped endpoints)
- **Export requests:** max 5 per minute

---

## References

- [Leadfeeder API docs](https://docs.leadfeeder.com/api/)
- [Dealfront Help Center](https://help.dealfront.com/)
