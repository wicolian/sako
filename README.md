<div align="center">

<img src="docs/screens/landing-home.png" alt="Sako landing page" width="100%" />

# Sako

### A design subscription with a GTM touch. The whole company, in one repo.

Landing page · waitlist · client portal · designer studio · billing API · GTM app · 44 automations<br/>
One `docker compose up`. Deploy to AWS, GCP, Azure or Vercel with Terraform.

<p>
  <a href="#run-it-in-one-command"><img alt="docker compose up" src="https://img.shields.io/badge/run-docker%20compose%20up-2496ED?logo=docker&logoColor=white" /></a>
  <a href="#self-host-with-prebuilt-images"><img alt="self-host" src="https://img.shields.io/badge/self--host-one%20line-111?logo=linux&logoColor=white" /></a>
  <a href="terraform/"><img alt="Terraform" src="https://img.shields.io/badge/deploy-AWS%20%7C%20GCP%20%7C%20Azure%20%7C%20Vercel-7B42BC?logo=terraform&logoColor=white" /></a>
  <img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000?logo=nextdotjs" />
  <img alt="NestJS" src="https://img.shields.io/badge/NestJS-10-E0234E?logo=nestjs&logoColor=white" />
  <img alt="n8n" src="https://img.shields.io/badge/n8n-44%20workflows-EA4B71?logo=n8n&logoColor=white" />
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Sako%20Source-B6F36A" /></a>
</p>

[The story](#the-story) · [What you get](#what-you-get) · [Screens](#screens) · [Architecture](#architecture) · [Run it](#run-it-in-one-command) · [Self-host](#self-host-with-prebuilt-images) · [Deploy](#deploy-to-any-cloud) · [Configuration](#configuration) · [Known issues](#known-issues) · [Support](#support-and-hire-me) · [License](#license)

</div>

---

## The story

Sako was a **productized design subscription** for B2B SaaS teams. One monthly fee. A queue of design
requests. Known delivery times (48-hour SLA per active slot). A GTM engine on top that turned the design
work into campaigns, outbound and PR.

| | |
|---|---|
| **Revenue** | About **$7,000 a month, for 8 months** |
| **Growth** | **10–40%** revenue growth |
| **The software** | Built by **one person**, with AI agents: Cursor, Claude Code, Codex, GLM and friends. No dev team |
| **What happened** | We sold the clients (**only the clients, not the code**) |

### Who made it

**Sako = *Sa*njay + *Ko*ushik**, the two founders.

- **Sanjay** ran the clients and the design: delivery, quality, and a team of **4 designers**.
- **Koushik** ([@wicolian](https://github.com/wicolian)) was the product and GTM person. He built every
  line of this software, and ran **1 HR person and 1 growth hacker**.

Almost 3 months of building with no funding and no backup.

Then we learned that the hard part was not the software. It was distribution, and the design-agency model
did not grow the way we wanted. When the agency side stops working, there is no point in keeping the
software locked up. So the whole stack is here, **landing page included**.

If you want to run a design subscription, a creative agency, a productized service, or any
"unlimited requests for a monthly fee" business, start here instead of from zero.

> [!WARNING]
> **Not maintained.** This is shared as-is. Some parts work end to end, some do not (see
> [Known issues](#known-issues)). Do your own security review before you take real money with it.

## What you get

| App | Folder | Port | What it does | Status |
|---|---|---|---|---|
| **Landing** | `apps/landing` | 3000 | Marketing site: home, pricing, how it works, services, ROI calculator, compare, enterprise, security, blog (MDX), legal pages, Cal.com booking | ✅ Works |
| **API** | `platform/services/api` | 3001 | NestJS API: Clerk auth, workspaces, tasks, SLAs, day credits, Stripe billing, Slack, email (Resend), S3 storage, AI drafts, cron jobs | ✅ Works |
| **Client portal** | `platform/apps/client` | 5173 | Where customers live: dashboard, plan and credits, tasks, review and approvals, calendar, brands, settings, billing | ✅ Works |
| **Studio** | `platform/apps/studio` | 3100 | Where the design team lives: operator overview, all tasks, task workspace, calendar, clients, billing inspector, user admin | ✅ Works |
| **Waitlist** | `apps/waitlist` | 3003 | Launch waitlist with countdown | ✅ Works |
| **Wall** | `apps/wall` | 3004 | Live business metrics for a TV screen: Stripe, PostHog, GA4, investor mode | ✅ Works |
| **n8n** | `n8n` | 5678 | 44 workflows: leads, content, PR, analytics, recruiting, infra | ✅ Runs (import workflows yourself) |
| **GTM app (Composer)** | `apps/gtm` | 3002 | AI GTM workspace: agent, campaigns, brand DNA, claims and evidence, competitors, newsletters, landing-page playground, AI marketing team, integrations | ✅ Works (needs Supabase, opt-in) |

<details>
<summary><b>The n8n workflows (44)</b></summary>

| Folder | Count | What they do |
|---|---|---|
| `leads/` | 14 | Lead lists, enrichment, scoring, outbound email, warm opens, call logging |
| `content/` | 8 | Content backlog, monitoring, drafting, publishing with Slack approval |
| `pr/` | 8 | Journalist monitoring, earned media outreach, media kit generator |
| `_shared/` | 5 | Error handler and shared sub-workflows |
| `analytics/` | 3 | Workflow metrics and reporting |
| `infra/` | 3 | Health checks and housekeeping |
| `recruiting/` | 3 | Designer outreach and candidate pipeline |

Sheet templates for every workflow are in `n8n/templates/`. Import order is in `n8n/docs/PUBLISH_ORDER.md`.

</details>

## Screens

All screens are from this repo, running locally with `docker compose up`, signed in as a demo user with
demo data.

### Client portal

<table>
<tr><td width="50%" valign="top"><img src="docs/screens/client-dashboard.png" alt="Dashboard: plan, credits, work in flight" width="100%"><br><sub><b>Dashboard: plan, credits, work in flight</b></sub></td><td width="50%" valign="top"><img src="docs/screens/client-tasks.png" alt="Tasks" width="100%"><br><sub><b>Tasks</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/client-task-detail.png" alt="Task detail and review" width="100%"><br><sub><b>Task detail and review</b></sub></td><td width="50%" valign="top"><img src="docs/screens/client-new-task.png" alt="New request" width="100%"><br><sub><b>New request</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/client-calendar.png" alt="Calendar" width="100%"><br><sub><b>Calendar</b></sub></td><td width="50%" valign="top"><img src="docs/screens/client-brands.png" alt="Brands" width="100%"><br><sub><b>Brands</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/client-settings.png" alt="Settings" width="100%"><br><sub><b>Settings</b></sub></td><td width="50%" valign="top"><img src="docs/screens/client-sign-up.png" alt="Sign up" width="100%"><br><sub><b>Sign up</b></sub></td></tr>
</table>

### Studio (the design team's side)

<table>
<tr><td width="50%" valign="top"><img src="docs/screens/studio-dashboard.png" alt="Operator overview" width="100%"><br><sub><b>Operator overview</b></sub></td><td width="50%" valign="top"><img src="docs/screens/studio-tasks.png" alt="All studio tasks" width="100%"><br><sub><b>All studio tasks</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/studio-tasks-t2.png" alt="Task workspace" width="100%"><br><sub><b>Task workspace</b></sub></td><td width="50%" valign="top"><img src="docs/screens/studio-calendar.png" alt="Studio calendar" width="100%"><br><sub><b>Studio calendar</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/studio-clients.png" alt="Clients" width="100%"><br><sub><b>Clients</b></sub></td><td width="50%" valign="top"><img src="docs/screens/studio-billing.png" alt="Billing inspector" width="100%"><br><sub><b>Billing inspector</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/studio-admin-users.png" alt="User management" width="100%"><br><sub><b>User management</b></sub></td><td width="50%" valign="top"><img src="docs/screens/studio-settings.png" alt="Settings" width="100%"><br><sub><b>Settings</b></sub></td></tr>
</table>

### GTM app (Composer)

<table>
<tr><td width="50%" valign="top"><img src="docs/screens/gtm-dashboard.png" alt="Dashboard" width="100%"><br><sub><b>Dashboard</b></sub></td><td width="50%" valign="top"><img src="docs/screens/gtm-agent.png" alt="GTM agent" width="100%"><br><sub><b>GTM agent</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/gtm-campaigns.png" alt="Campaigns" width="100%"><br><sub><b>Campaigns</b></sub></td><td width="50%" valign="top"><img src="docs/screens/gtm-playground.png" alt="Landing-page playground" width="100%"><br><sub><b>Landing-page playground</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/gtm-team.png" alt="AI marketing team" width="100%"><br><sub><b>AI marketing team</b></sub></td><td width="50%" valign="top"><img src="docs/screens/gtm-brand-dna.png" alt="Brand DNA" width="100%"><br><sub><b>Brand DNA</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/gtm-claims.png" alt="Claims review" width="100%"><br><sub><b>Claims review</b></sub></td><td width="50%" valign="top"><img src="docs/screens/gtm-competitors.png" alt="Competitor intelligence" width="100%"><br><sub><b>Competitor intelligence</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/gtm-iq.png" alt="IQ" width="100%"><br><sub><b>IQ</b></sub></td><td width="50%" valign="top"><img src="docs/screens/gtm-newsletters.png" alt="Newsletter generator" width="100%"><br><sub><b>Newsletter generator</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/gtm-automation.png" alt="Automation playbooks" width="100%"><br><sub><b>Automation playbooks</b></sub></td><td width="50%" valign="top"><img src="docs/screens/gtm-integrations.png" alt="Integrations" width="100%"><br><sub><b>Integrations</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/gtm-analytics.png" alt="Analytics" width="100%"><br><sub><b>Analytics</b></sub></td><td width="50%" valign="top"><img src="docs/screens/gtm-onboarding.png" alt="Onboarding" width="100%"><br><sub><b>Onboarding</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/gtm-settings.png" alt="Settings" width="100%"><br><sub><b>Settings</b></sub></td></tr>
</table>

### Landing page

<table>
<tr><td width="50%" valign="top"><img src="docs/screens/landing-pricing.png" alt="Pricing" width="100%"><br><sub><b>Pricing</b></sub></td><td width="50%" valign="top"><img src="docs/screens/landing-how-it-works.png" alt="How it works" width="100%"><br><sub><b>How it works</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/landing-services.png" alt="Services" width="100%"><br><sub><b>Services</b></sub></td><td width="50%" valign="top"><img src="docs/screens/landing-roi-calculator.png" alt="ROI calculator" width="100%"><br><sub><b>ROI calculator</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/landing-compare.png" alt="Compare" width="100%"><br><sub><b>Compare</b></sub></td><td width="50%" valign="top"><img src="docs/screens/landing-enterprise.png" alt="Enterprise" width="100%"><br><sub><b>Enterprise</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/landing-security.png" alt="Security" width="100%"><br><sub><b>Security</b></sub></td><td width="50%" valign="top"><img src="docs/screens/landing-about.png" alt="About" width="100%"><br><sub><b>About</b></sub></td></tr>
<tr><td width="50%" valign="top"><img src="docs/screens/landing-blog.png" alt="Blog" width="100%"><br><sub><b>Blog</b></sub></td><td width="50%" valign="top"><img src="docs/screens/landing-book-a-call.png" alt="Book a call" width="100%"><br><sub><b>Book a call</b></sub></td></tr>
</table>

### Waitlist and wall

<table>
<tr><td width="50%" valign="top"><img src="docs/screens/waitlist.png" alt="Waitlist" width="100%"><br><sub><b>Waitlist</b></sub></td><td width="50%" valign="top"><img src="docs/screens/wall.png" alt="Wall" width="100%"><br><sub><b>Wall</b></sub></td></tr>
</table>

<details>
<summary><b>Every screen, full size</b></summary>

<!-- before-and-after:start -->
| Preview (Landing: home) |
|:---:|
| ![Preview](./docs/screens/landing-home.png) |

| Preview (Landing: pricing) |
|:---:|
| ![Preview](./docs/screens/landing-pricing.png) |

| Preview (Landing: how it works) |
|:---:|
| ![Preview](./docs/screens/landing-how-it-works.png) |

| Preview (Landing: services) |
|:---:|
| ![Preview](./docs/screens/landing-services.png) |

| Preview (Landing: roi calculator) |
|:---:|
| ![Preview](./docs/screens/landing-roi-calculator.png) |

| Preview (Landing: compare) |
|:---:|
| ![Preview](./docs/screens/landing-compare.png) |

| Preview (Landing: enterprise) |
|:---:|
| ![Preview](./docs/screens/landing-enterprise.png) |

| Preview (Landing: security) |
|:---:|
| ![Preview](./docs/screens/landing-security.png) |

| Preview (Landing: about) |
|:---:|
| ![Preview](./docs/screens/landing-about.png) |

| Preview (Landing: blog) |
|:---:|
| ![Preview](./docs/screens/landing-blog.png) |

| Preview (Landing: book a call) |
|:---:|
| ![Preview](./docs/screens/landing-book-a-call.png) |

| Preview (Client: dashboard) |
|:---:|
| ![Preview](./docs/screens/client-dashboard.png) |

| Preview (Client: tasks) |
|:---:|
| ![Preview](./docs/screens/client-tasks.png) |

| Preview (Client: task detail) |
|:---:|
| ![Preview](./docs/screens/client-task-detail.png) |

| Preview (Client: new task) |
|:---:|
| ![Preview](./docs/screens/client-new-task.png) |

| Preview (Client: calendar) |
|:---:|
| ![Preview](./docs/screens/client-calendar.png) |

| Preview (Client: brands) |
|:---:|
| ![Preview](./docs/screens/client-brands.png) |

| Preview (Client: settings) |
|:---:|
| ![Preview](./docs/screens/client-settings.png) |

| Preview (Client: sign up) |
|:---:|
| ![Preview](./docs/screens/client-sign-up.png) |

| Preview (Studio: dashboard) |
|:---:|
| ![Preview](./docs/screens/studio-dashboard.png) |

| Preview (Studio: tasks) |
|:---:|
| ![Preview](./docs/screens/studio-tasks.png) |

| Preview (Studio: tasks t2) |
|:---:|
| ![Preview](./docs/screens/studio-tasks-t2.png) |

| Preview (Studio: calendar) |
|:---:|
| ![Preview](./docs/screens/studio-calendar.png) |

| Preview (Studio: clients) |
|:---:|
| ![Preview](./docs/screens/studio-clients.png) |

| Preview (Studio: billing) |
|:---:|
| ![Preview](./docs/screens/studio-billing.png) |

| Preview (Studio: admin users) |
|:---:|
| ![Preview](./docs/screens/studio-admin-users.png) |

| Preview (Studio: settings) |
|:---:|
| ![Preview](./docs/screens/studio-settings.png) |

| Preview (Studio: sign in) |
|:---:|
| ![Preview](./docs/screens/studio-sign-in.png) |

| Preview (GTM: dashboard) |
|:---:|
| ![Preview](./docs/screens/gtm-dashboard.png) |

| Preview (GTM: agent) |
|:---:|
| ![Preview](./docs/screens/gtm-agent.png) |

| Preview (GTM: campaigns) |
|:---:|
| ![Preview](./docs/screens/gtm-campaigns.png) |

| Preview (GTM: playground) |
|:---:|
| ![Preview](./docs/screens/gtm-playground.png) |

| Preview (GTM: team) |
|:---:|
| ![Preview](./docs/screens/gtm-team.png) |

| Preview (GTM: brand dna) |
|:---:|
| ![Preview](./docs/screens/gtm-brand-dna.png) |

| Preview (GTM: claims) |
|:---:|
| ![Preview](./docs/screens/gtm-claims.png) |

| Preview (GTM: competitors) |
|:---:|
| ![Preview](./docs/screens/gtm-competitors.png) |

| Preview (GTM: iq) |
|:---:|
| ![Preview](./docs/screens/gtm-iq.png) |

| Preview (GTM: newsletters) |
|:---:|
| ![Preview](./docs/screens/gtm-newsletters.png) |

| Preview (GTM: automation) |
|:---:|
| ![Preview](./docs/screens/gtm-automation.png) |

| Preview (GTM: integrations) |
|:---:|
| ![Preview](./docs/screens/gtm-integrations.png) |

| Preview (GTM: analytics) |
|:---:|
| ![Preview](./docs/screens/gtm-analytics.png) |

| Preview (GTM: onboarding) |
|:---:|
| ![Preview](./docs/screens/gtm-onboarding.png) |

| Preview (GTM: settings) |
|:---:|
| ![Preview](./docs/screens/gtm-settings.png) |

| Preview (Waitlist) |
|:---:|
| ![Preview](./docs/screens/waitlist.png) |

| Preview (Wall) |
|:---:|
| ![Preview](./docs/screens/wall.png) |

<!-- before-and-after:end -->

</details>

## Architecture

```mermaid
flowchart LR
    subgraph People
        V([Visitor])
        C([Client])
        D([Designer / operator])
    end

    subgraph Web["Web apps"]
        L["Landing<br/>Next.js · :3000"]
        W["Waitlist<br/>Vite · :3003"]
        CP["Client portal<br/>React + Vite · :5173"]
        ST["Studio<br/>React + Vite · :3100"]
        G["GTM app<br/>Next.js · :3002"]
        WL["Wall<br/>Next.js · :3004"]
    end

    subgraph Core["Backend"]
        API["API<br/>NestJS · :3001"]
        WK["Worker + cron<br/>(in the API)"]
        N8N["n8n<br/>44 workflows · :5678"]
    end

    subgraph Data
        PG[("Postgres 16<br/>platform · gtm · wall · n8n")]
        R[("Redis<br/>queues")]
        S3[("S3-compatible<br/>file storage")]
    end

    subgraph SaaS["Outside services (your keys)"]
        CL[Clerk]
        SP[Stripe]
        SL[Slack]
        RS[Resend]
        AI[OpenAI / Anthropic]
    end

    V --> L & W
    C --> CP
    D --> ST
    D --> G
    CP & ST --> API
    CP & ST -. sign in .-> CL
    API --> PG & R & S3
    API --> SP & SL & RS & AI
    API -. verify JWT .-> CL
    WK --> R
    G --> SB[("Supabase<br/>Postgres + Auth")]
    G --> AI
    G -. send to Sako .-> API
    CP -. Composer link .-> G
    WL --> PG
    N8N --> PG
    N8N --> SL & AI
    SP -. webhooks .-> API
    SL -. events .-> API
```

### How a design request moves

```mermaid
sequenceDiagram
    autonumber
    participant C as Client portal
    participant A as API
    participant DB as Postgres
    participant S as Studio
    participant SL as Slack
    C->>A: New task (brief, brand, files)
    A->>DB: Save task (QUEUED), check active slots
    A-->>SL: Post to the client's channel
    S->>A: Designer picks it up
    A->>DB: IN_PROGRESS, start the 48h SLA clock
    S->>A: Upload deliverable
    A->>DB: IN_REVIEW
    A-->>C: Notify "ready for review"
    C->>A: Approve or ask for a revision
    A->>DB: COMPLETED (or back to IN_PROGRESS)
    Note over A,DB: Cron burns 1 day credit per active day,<br/>pausing stops the burn
```

### Billing in one picture

```mermaid
flowchart LR
    P[Pricing page] -->|Stripe Checkout| SP[Stripe]
    SP -->|webhook| API
    API -->|subscription ACTIVE| DB[(subscriptions)]
    DB --> CR[Day credits + active slots]
    CR --> CP[Client dashboard]
```

### Deploy targets

```mermaid
flowchart TB
    IMG["Images on GHCR<br/>ghcr.io/&lt;owner&gt;/sako-*"]
    IMG --> DC["docker compose<br/>(one machine)"]
    IMG --> AWS["AWS<br/>App Runner + RDS + S3"]
    IMG --> GCP["GCP<br/>Cloud Run + Cloud SQL + GCS"]
    IMG --> AZ["Azure<br/>Container Apps + Postgres + Storage"]
    GH["Your fork on GitHub"] --> VNR["Vercel + Neon + Railway<br/>(builds from source)"]
```

## Run it in one command

You need Docker (Docker Desktop, OrbStack or Colima all work).

```bash
git clone https://github.com/wicolian/sako && cd sako
cp .env.example .env          # add your keys. Empty = that feature is off.
docker compose up -d --build  # first build takes a few minutes
```

Open http://localhost:3000. All URLs:

| | URL |
|---|---|
| Landing | http://localhost:3000 |
| API | http://localhost:3001 |
| Waitlist | http://localhost:3003 |
| Wall | http://localhost:3004 |
| Studio | http://localhost:3100 |
| Client portal | http://localhost:5173 |
| n8n | http://localhost:5678 |
| GTM app (opt-in, needs Supabase) | `docker compose --profile gtm up -d --build` → http://localhost:3002 |

**The minimum keys to sign in:** a free [Clerk](https://clerk.com) development instance
(`CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`) and `ALLOWED_STUDIO_DOMAINS` set to your team's email
domain. Add [Stripe](https://stripe.com) test keys to take payments.

<details>
<summary><b>Give yourself a demo workspace (skip Stripe)</b></summary>

Sign up in the client portal once, then run:

```bash
docker compose exec -T postgres psql -U sako -d platform <<'SQL'
insert into workspaces(id,name,slug,"updatedAt","hasOnboarded") values ('ws_demo','Acme Growth','acme-growth',now(),true);
insert into workspace_members(id,"workspaceId","userId",role,"updatedAt") select 'wm_demo','ws_demo',id,'OWNER',now() from users limit 1;
insert into subscriptions(id,"workspaceId",status,"planCode","activeTaskLimit","slaSeconds","billingPeriodStart","billingPeriodEnd","updatedAt")
  values ('sub_demo','ws_demo','ACTIVE','OPS',2,172800,now(),now()+interval '30 days',now());
SQL
```

To open the studio as that user: `update users set role='ADMIN';` and make sure the email domain is in
`ALLOWED_STUDIO_DOMAINS`.

</details>

## Self-host with prebuilt images

Every push to `main` builds all images and pushes them to GitHub Container Registry. Self-hosters do not
need to build anything:

```bash
curl -fsSL https://raw.githubusercontent.com/wicolian/sako/main/selfhost/install.sh | sh
```

The script downloads `docker-compose.yml`, makes a `.env` with random database and n8n secrets, pulls the
images and starts everything. Pin a version with `SAKO_VERSION=<tag>`. Use your own fork's images with
`SAKO_IMAGE_OWNER=<your-github-user>`.

> [!NOTE]
> The client and studio are static builds, so Clerk's publishable key is baked in at build time. With the
> prebuilt images, rebuild those two with your key: `docker compose build client studio`.

## Deploy to any cloud

Pick one folder in [`terraform/`](terraform/). Each one makes a Postgres, a file bucket and one service per app.

| Folder | Database | Apps run on | Best for |
|---|---|---|---|
| [`vercel-neon-railway`](terraform/vercel-neon-railway) | Neon | Vercel (web) + Railway (API, n8n) | Fastest start, cheapest |
| [`aws`](terraform/aws) | RDS Postgres 16 | App Runner + S3 | AWS shops |
| [`gcp`](terraform/gcp) | Cloud SQL Postgres 16 | Cloud Run + GCS | Google Cloud |
| [`azure`](terraform/azure) | Postgres Flexible Server | Container Apps + Storage | Azure |

```bash
cd terraform/gcp
cp terraform.tfvars.example terraform.tfvars   # tokens, keys, image names
terraform init
terraform apply
```

All four pass `terraform validate` in CI. They are starting points, not hardened setups: the databases
accept connections from the internet with a password. Lock them down before real customers use them.
More in [`terraform/README.md`](terraform/README.md).

## Configuration

One `.env` at the root feeds every app (`.env.example` lists all ~190 keys, grouped by app). The ones
that matter most:

| Key | Used by | What for |
|---|---|---|
| `POSTGRES_PASSWORD` | all | Database password (the installer makes a random one) |
| `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY` | API, client, studio | Sign-in |
| `ALLOWED_STUDIO_DOMAINS` | API, studio | Email domains allowed into the studio, e.g. `yourcompany.com` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY` | API, client | Subscriptions and checkout |
| `RESEND_API_KEY`, `EMAIL_FROM` | API | Transactional and marketing email |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_SIGNING_SECRET`, `SLACK_BOT_TOKEN` | API, n8n | Per-client Slack channels and approvals |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` | API, GTM, n8n | AI drafts, estimates, content |
| `STORAGE_*` | API | S3-compatible bucket for uploads (Cloudflare R2 works) |
| `N8N_ENCRYPTION_KEY` | n8n | Encrypts stored credentials |
| `SAKO_IMAGE_OWNER`, `SAKO_VERSION` | compose | Which prebuilt images to pull |

## Project layout

```
sako/
├── apps/
│   ├── landing/          Next.js 16 + MDX marketing site
│   │   ├── content/      Every page and blog post as MDX
│   │   └── src/config/   Brand, links, nav, pricing: change these first
│   ├── waitlist/         Vite + React waitlist (+ a Vercel function)
│   ├── wall/             Next.js live metrics dashboard (TV kiosk)
│   └── gtm/              Next.js GTM app, Postgres migrations, browser extension
├── platform/
│   ├── apps/client/      Client portal (React 18 + Vite + Clerk)
│   ├── apps/studio/      Studio (React 18 + Vite + Clerk)
│   ├── packages/         Shared review UI
│   └── services/api/     NestJS 10 + Prisma 5: auth, tasks, billing, Slack, AI, cron
├── n8n/
│   ├── workflows/        44 workflow JSON files, by area
│   └── templates/        Google Sheets templates the workflows read and write
├── terraform/            aws · gcp · azure · vercel-neon-railway
├── selfhost/install.sh   One-line installer for prebuilt images
├── docker/               Postgres init (one database per app)
├── docs/screens/         The screenshots above
├── .github/workflows/    CI and image publishing
└── docker-compose.yml    Everything, one command
```

Agent instructions (`CLAUDE.md`, `AGENTS.md`, Cursor and agent rules) are kept in on purpose. They are how
this was built, and they help your agents work on it too.

## Develop one app at a time

```bash
# API + client + studio (npm workspaces)
cd platform && npm install && npm run dev

# Landing (pnpm 8)
cd apps/landing && pnpm install && pnpm dev

# GTM app (bun)
cd apps/gtm && bun install && bun dev
```

## Make it yours

1. **Brand:** name, colors, nav and pricing live in `apps/landing/src/config/`. Logos in `public/` of each app.
2. **Domains and emails:** search for `trysako.com` and `example.com` and put in your own.
3. **Plans:** plan codes and limits are in the API (`platform/services/api/src/subscription`) and the `plans` table.
4. **Booking link:** set your Cal.com handle in `apps/landing/src/components/blocks/CalEmbed.tsx`.
5. **Automations:** import the n8n workflows in the order in `n8n/docs/PUBLISH_ORDER.md`, then add your credentials in n8n.

## CI/CD

| Workflow | When | What |
|---|---|---|
| `ci.yml` | Every PR and push | Secret scan (gitleaks), `terraform fmt` + `validate` for all 4 clouds, `docker compose config` |
| `images.yml` | Push to `main` | Builds 8 images, pushes `ghcr.io/<owner>/sako-*:latest` |

## Known issues

These are tracked as [GitHub issues](https://github.com/wicolian/sako/issues). The big ones:

- **GTM app needs Supabase**, not the shared Postgres. A few GTM pages (assets, editor, kit) give 404, and some show "No workspace found".
- **Client pricing page is empty** until you set your own Stripe pricing table or plans.
- **Studio "AI" page renders empty cards.**
- **Pods page is a placeholder.**

Fixes are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Support and hire me

If Sako saved you months of work, you can say thanks:

- ⭐ **Star the repo.** It helps other founders find it.
- 💚 **Sponsor me** on [GitHub Sponsors](https://github.com/sponsors/wicolian) (the ♥ Sponsor button at the top of the repo).
- 🤝 **Hire me:** I do paid **forward-deployed engineering (FDE)** and freelance sessions: I set up Sako
  (or something like it) for your business, or build your product and GTM stack with AI agents.

Get in touch: **[kelashik.com](https://kelashik.com)** · **[LinkedIn](https://www.linkedin.com/in/kelashik)**

## Contributing

Pull requests are welcome. `main` is protected, and every PR is reviewed by the owner before it is merged.
Read [CONTRIBUTING.md](CONTRIBUTING.md) first.

## License

[Sako Source License](LICENSE). In short:

- ✅ Fork it, study it, use it as a reference, change it, and run your own business on it.
- ✅ Open pull requests.
- ❌ Do not sell this code as it is (as a template, boilerplate or product), in whole or in part.

This is a source-available license, not an OSI open-source license.

---

<div align="center">

**Built solo, with AI agents.** © 2026 Koushik Venkatesan ([@wicolian](https://github.com/wicolian)) · [kelashik.com](https://kelashik.com) · [LinkedIn](https://www.linkedin.com/in/kelashik)

</div>
