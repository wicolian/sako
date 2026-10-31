# Sako — design subscription with a GTM touch

The whole stack of a real design-subscription startup, open-sourced: landing page, waitlist,
client portal, studio (the designers' side), a GTM app for campaigns and assets, an API with
Stripe billing, and 40+ n8n workflows for outbound, PR and recruiting.

Fork it, add your database and keys, and you have a design agency in a box.

## The story

Sako was a productized design subscription. We ran at about **$7,000 a month for 8 months**,
with **10–40% revenue growth**. Then we learned the hard part was not the software.
It was distribution, and the design-agency model did not grow the way we wanted.

So we sold the clients (only the clients, not the code), and we are giving the software away.
If you want to run a design subscription, a creative agency, or any "unlimited requests for a
monthly fee" business, start here instead of from zero.

**This is not maintained.** It is shared as-is. Expect rough edges, and do your own security
review before you take real money with it.

## What's inside

| Folder | What it is | Stack |
|---|---|---|
| `apps/landing` | Marketing site, blog, pricing, legal pages | Next.js, MDX |
| `apps/waitlist` | Waitlist page | Vite + React, Vercel function |
| `apps/wall` | Public wall / showcase | Next.js, Prisma |
| `apps/gtm` | GTM app: campaigns, AI assets, brand kits, browser extension | Next.js, Postgres, Clerk |
| `platform/apps/client` | Client portal: requests, approvals, billing | Vite + React |
| `platform/apps/studio` | Studio: designer queue, SLAs, admin | Vite + React |
| `platform/services/api` | API: auth, Stripe, Slack, email, storage | NestJS-style Node API |
| `n8n` | 40+ automation workflows + sheet templates | n8n (Docker) |
| `terraform` | One-command deploy of all of the above | Terraform |

## Quick start (local)

Each app runs on its own. Copy the example env, fill it in, install, run:

```bash
cd platform && cp .env.example .env && docker compose up      # API + client + studio + Postgres
cd apps/gtm && cp .env.example .env.local && bun install && bun dev
cd apps/landing && pnpm install && pnpm dev
cd n8n && cp .env.example .env && docker compose up
```

## Deploy everything (Terraform)

Creates: one Neon Postgres (a database per app), Vercel projects for the 6 web apps,
and a Railway project for the API and n8n.

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # add your tokens and keys
terraform init
terraform apply
```

You need accounts on Neon, Vercel, Railway, Clerk and Stripe. Optional: OpenAI / Anthropic,
Resend, Slack, PostHog, Sentry, an S3-compatible bucket (Cloudflare R2 works).

## Make it yours

- Change the name, copy and colors in `apps/landing/src/config/`.
- Search for `trysako.com` and `example.com` and put in your own domain and emails.
- Import the n8n workflows from `n8n/workflows/` in the order in `n8n/docs/PUBLISH_ORDER.md`.

## License

MIT. Do what you want with it.
