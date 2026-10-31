# Agent guide for the Sako monorepo

Read this first. Each app also has its own `AGENTS.md` or `CLAUDE.md` with deeper rules.

## What is where
| Folder | What | Stack | Run alone |
|---|---|---|---|
| `apps/landing` | Marketing site + blog (MDX) | Next.js 16, pnpm 8 | `pnpm dev` |
| `apps/waitlist` | Waitlist page | Vite + React | `npm run dev` |
| `apps/wall` | Live metrics TV screen | Next.js 15, Prisma | `npm run dev` |
| `apps/gtm` | GTM app (Composer) | Next.js 16, Supabase, bun | `bun dev` |
| `platform/apps/client` | Client portal | React 18, Vite, Clerk | `npm run dev:client` |
| `platform/apps/studio` | Design team studio | React 18, Vite, Clerk | `npm run dev:studio` |
| `platform/services/api` | API | NestJS 10, Prisma 5 | `npm run dev` |
| `n8n` | 44 automation workflows | n8n 2.x | `docker compose up n8n` |
| `terraform` | Deploy to AWS, GCP, Azure, Vercel+Neon+Railway | Terraform | `terraform apply` |
| `docs/product` | Product specs, updated to match the code | Markdown | |
| `docs/playbooks` | Founder playbooks | Markdown | |

The whole stack: `cp .env.example .env && docker compose up -d --build`. Demo data: `docker/seed-demo.sql`.

## How the apps connect
- Client portal and studio call the API (`VITE_API_BASE_URL`). Sign-in is Clerk.
- The client portal links to the GTM app (`VITE_COMPOSER_URL`). The GTM app sends work to the API (`SAKO_V1_API_URL`).
- The wall reads the platform database (`SAKO_DATABASE_URL`) and the GTM database (`COMPOSER_DATABASE_URL`).
- Platform, wall and n8n share one Postgres (a database each). The GTM app uses its own Supabase.

## Rules
- Never commit secrets, `.env` files, real customer or lead data, or personal emails. CI runs gitleaks on every PR.
- Every change goes through a pull request. `main` is protected and the owner reviews every PR.
- Keep each PR to one change. Say how you checked it.
- When you change behaviour, update the matching doc in `docs/product/` and the README if a user would notice.
- Known problems are GitHub issues. Check them before you "discover" a bug.
