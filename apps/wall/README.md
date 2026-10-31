# Sako Wall

Real-time business metrics dashboard for Sako. Runs as a Next.js fullstack app on Vercel, designed for TV kiosk display on Raspberry Pi 5.

## Features

- **Real-time metrics** from Stripe, PostHog, GA4, Sako DB, and Composer DB
- **Aggressive caching** with Neon-backed cache (survives serverless cold starts)
- **Data trust layer** - never lies, shows source health and staleness
- **Investor mode** - masks sensitive revenue and customer data
- **Snapshots** - 15-minute historical data for trend charts
- **Shared password auth** - 7-day session cookies
- **IST timezone** - all "today" and "MTD" calculations use IST

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push schema to database
npm run db:push

# Run development server
npm run dev
```

## Deployment to Vercel

### 1. Create Wall Database

Create a **new Neon project** for the Wall app's data:

1. Go to [Neon Console](https://console.neon.tech)
2. Create new project named "sako-wall"
3. Copy the connection string

### 2. Configure Environment Variables

In Vercel project settings, add these environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `WALL_PASSWORD` | ✅ | Shared password for wall access |
| `SESSION_SECRET` | ✅ | `openssl rand -hex 32` |
| `CRON_SECRET` | ✅ | `openssl rand -hex 16` |
| `DATABASE_URL` | ✅ | Wall Neon connection string |
| `SAKO_DB_URL` | ✅ | Sako-v1 Neon (read-only) |
| `COMPOSER_DB_URL` | ✅ | Composer Neon (read-only) |
| `STRIPE_SECRET_KEY` | ✅ | Stripe API key |
| `POSTHOG_API_KEY` | ✅ | PostHog personal API key |
| `POSTHOG_PROJECT_ID` | ✅ | PostHog project ID (numeric) |
| `GA4_PROPERTY_ID` | ❌ | Numeric property ID (optional) |
| `GA4_SERVICE_ACCOUNT_JSON` | ❌ | Service account JSON (optional) |

### 3. Deploy

```bash
vercel --prod
```

### 4. Initialize Database

After first deployment:

```bash
# Push Prisma schema to production
npx prisma db push
```

## Snapshot Cron Job

The wall needs a cron job to collect snapshots every 15 minutes. Since we don't want to depend on Vercel-specific features, use GitHub Actions:

### GitHub Actions Workflow

Create `.github/workflows/snapshot.yml`:

```yaml
name: Wall Snapshot

on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
  workflow_dispatch:  # Manual trigger

jobs:
  snapshot:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Snapshot
        run: |
          curl -X POST \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json" \
            https://your-wall-domain.vercel.app/api/wall/snapshot/run
```

Add `CRON_SECRET` to your GitHub repository secrets.

## Pi5 Kiosk Setup

### Prerequisites

- Raspberry Pi 5 with Raspberry Pi OS
- Chromium browser (pre-installed)
- Network connection

### Setup Steps

#### 1. Disable Screen Blanking

Edit `/etc/lightdm/lightdm.conf`:

```ini
[Seat:*]
xserver-command=X -s 0 -dpms
```

Or via command:

```bash
# Disable screen blanking
xset s off
xset -dpms
xset s noblank
```

#### 2. Create Autostart Script

Create `/home/pi/.config/autostart/sako-wall.desktop`:

```ini
[Desktop Entry]
Type=Application
Name=Sako Wall
Exec=/home/pi/start-wall.sh
```

Create `/home/pi/start-wall.sh`:

```bash
#!/bin/bash

# Wait for network
sleep 10

# Kill any existing Chromium
killall chromium-browser 2>/dev/null

# Clear Chromium cache
rm -rf ~/.config/chromium/Default/Cache/*

# Start Chromium in kiosk mode
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --disable-session-crashed-bubble \
  --disable-restore-session-state \
  --disable-translate \
  --no-first-run \
  --start-fullscreen \
  --incognito \
  "https://your-wall-domain.vercel.app/wall"
```

Make executable:

```bash
chmod +x /home/pi/start-wall.sh
```

#### 3. Login Once

1. Boot the Pi and navigate to your wall URL manually
2. Enter the shared password
3. The session cookie persists for 7 days
4. Reboot to test autostart

#### 4. Optional: Prevent Desktop Login Prompt

For a cleaner TV experience, enable auto-login:

```bash
sudo raspi-config
# System Options > Boot / Auto Login > Desktop Autologin
```

### Keyboard Shortcuts

While the wall is running:

| Key | Action |
|-----|--------|
| `R` | Refresh data |
| `I` | Toggle investor mode |
| `F` | Toggle fullscreen |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Vercel (Next.js)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │ /wall   │  │ /login  │  │ /detail │  │ /admin  │        │
│  │  page   │  │  page   │  │  page   │  │ /manual │        │
│  └────┬────┘  └─────────┘  └────┬────┘  └────┬────┘        │
│       │                         │             │             │
│       └─────────────┬───────────┘             │             │
│                     ▼                         │             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              /api/wall/* (Aggregator)                │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐    │  │
│  │  │ summary │ │ metric  │ │snapshot │ │ manual  │    │  │
│  │  └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘    │  │
│  └───────┼───────────┼───────────┼───────────┼─────────┘  │
│          │           │           │           │             │
│          ▼           ▼           ▼           ▼             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Cache Layer (Neon-backed)               │  │
│  │  ┌──────────────────────────────────────────────┐   │  │
│  │  │ wall_cache │ wall_source_status │ fallback   │   │  │
│  │  └──────────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │  Stripe  │        │ PostHog  │        │   GA4    │
   │   API    │        │   API    │        │   API    │
   └──────────┘        └──────────┘        └──────────┘
         │
         │       ┌───────────────────────────────────┐
         │       │         Neon PostgreSQL           │
         │       ├───────────────┬───────────────────┤
         │       │   sako_db     │   composer_db     │
         │       │  (read-only)  │   (read-only)     │
         │       └───────────────┴───────────────────┘
         │
         ▼
   ┌──────────────────────────────────────────────────┐
   │            Wall Neon DB (read/write)             │
   │  ┌────────────────────────────────────────────┐  │
   │  │ wall_cache │ wall_snapshots │ wall_status  │  │
   │  │ wall_manual_inputs │ wall_sessions         │  │
   │  └────────────────────────────────────────────┘  │
   └──────────────────────────────────────────────────┘
```

## Metrics Contract

All metrics are defined in `src/config/metrics.ts`. Each metric specifies:

- **source**: Where data comes from (stripe, posthog, ga4, sako_db, composer_db, manual)
- **ttlSeconds**: How long to cache
- **staleAfterSeconds**: When to show "stale" warning
- **investorSafe**: Whether to show in investor mode
- **goalDirection**: Whether higher or lower is better

## Data Trust States

| State | Meaning |
|-------|---------|
| `OK` | Source healthy, data fresh |
| `DEGRADED` | Recent errors, but working |
| `STALE` | Data older than threshold |
| `DOWN` | Multiple consecutive failures |

When a source fails, the wall shows the **last known good** value from cache and marks it appropriately.

## Development

```bash
# Run with hot reload
npm run dev

# Type check
npx tsc --noEmit

# Lint
npm run lint

# Database studio
npm run db:studio
```

## Troubleshooting

### "Source DOWN" for all sources

Check that environment variables are correctly set. The wall needs at minimum:
- `DATABASE_URL` (for its own cache/sessions)
- `STRIPE_SECRET_KEY` (for revenue metrics)
- `POSTHOG_HOST` + `POSTHOG_API_KEY` (for DAU)

### Session expires before 7 days

Check that `SESSION_SECRET` is the same across all deployments. If it changes, existing sessions become invalid.

### GA4 "not configured" fallback

This is expected if you haven't provided:
- `GA4_PROPERTY_ID` (must be numeric, not G-XXXXXXXXXX)
- `GA4_SERVICE_ACCOUNT_JSON` (service account with GA4 viewer access)

The wall falls back to PostHog pageviews for the "Visits" metric.

### Pi5 shows login screen on boot

The session cookie may have expired. Login once manually, then let the 7-day session persist. For longer periods, consider implementing a device-based auth token.

## License

Private - Sako internal use only.
