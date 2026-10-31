# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this project?

Sako Composer is an AI-native Go-to-Market platform. It generates marketing campaigns (landing pages, emails, sales decks, social posts, video scripts) with built-in compliance validation (ClaimsOS). Users paste a URL, AI extracts brand identity and claims, validates them against policy, and deploys to 20+ channels.

## Commands

```bash
# Development
bun dev              # Start Next.js dev server (DO NOT use bun build during dev sessions)
bun lint             # ESLint
bun run typecheck    # TypeScript type checking
bun run test         # Canonical Vitest unit/integration suite
bun run test:evals   # AI prompt eval tests (__tests__/evals/, requires OPENROUTER_API_KEY)
bun run test:e2e     # Playwright end-to-end tests
bun run test:e2e --list  # List Playwright coverage without running it

# Single test file
bunx vitest run tests/path/to/file.test.ts

# CI pipeline (runs policy check + typecheck + tests)
bun run ci

# Policy check (scans for legacy model IDs, banned patterns)
bun run policy:check

# Database
bun run db:push      # Push Supabase migrations
bun run db:migrate   # Run migration script

# MCP server
bun run mcp
```

## Architecture

### Tech Stack
- **Next.js 16.1** (App Router, React 19, Turbopack) with **Bun** runtime
- **TypeScript 5.7** (strict mode)
- **Tailwind CSS 4.0** + **shadcn/ui** (Radix primitives)
- **Supabase** (Postgres + RLS + Auth + pgvector + Storage)
- **Vercel AI SDK 6.x** via **OpenRouter** (`@openrouter/ai-sdk-provider`) for all model calls — see `lib/ai/ai-sdk-client.ts`, `lib/ai/openrouter.ts`, `lib/ai/model-router.ts`, `lib/ai/openrouter-model-catalog.ts`
- **LangGraph 1.x** for ClaimsOS validation pipelines
- **Trigger.dev v3** for background jobs
- **Stripe** for subscriptions and usage billing

### Route Layout
- `app/(app)/` — Authenticated routes (dashboard, campaigns, editor, etc.)
- `app/api/` — 100+ API route handlers
- `app/login/`, `app/signup/` — Public auth pages

### Middleware (`middleware.ts`)
Every request goes through middleware that:
1. Skips public paths (`/login`, `/signup`, `/api/v1/validate`, etc.)
2. Authenticates via Supabase Auth
3. Resolves workspace membership and injects `x-workspace-id`, `x-user-id`, `x-user-role` headers
4. Redirects unauthenticated users to `/login`, workspace-less users to `/onboarding`

### Workspace Context
API routes extract workspace/user context from middleware-injected headers via `lib/workspace.ts`:
```ts
import { getWorkspaceId, getUserId } from '@/lib/workspace'
const workspaceId = getWorkspaceId(request)
```

### Supabase Clients
Three client variants in `lib/supabase/`:
- `server.ts` → `createServerSupabaseClient()` (aliased as `createClient`) — Server Components & Route Handlers, uses `next/headers` cookies
- `client.ts` → `createClient()` — Browser/Client Components
- `service.ts` → Service role client for admin operations (bypasses RLS)

### AI Integration (Non-negotiable pattern)
All AI calls MUST go through `lib/ai/ai-sdk-client.ts` or use `getModel()` from `lib/ai/model-router.ts`. Never import provider SDKs directly.
```ts
import { createAIClient } from '@/lib/ai/ai-sdk-client'
const ai = createAIClient()
// Or for model string: import { getModel } from '@/lib/ai/model-router'
```

Model IDs must come from the allowlist in `.cursor/rules/latest-models-only.mdc`. The `policy:check` script enforces this in CI. OpenRouter model catalog and cost estimates: `lib/ai/openrouter-model-catalog.ts`.

### ClaimsOS (Compliance Engine)
`lib/claims/` contains a LangGraph-based validation pipeline (`validation-graph.ts`) with a rules engine (`rules-engine.ts`) that validates marketing claims against configurable policies. This is compliance-critical code — ask before modifying.

### Key Subsystems
| Subsystem | Location | Purpose |
|-----------|----------|---------|
| AI (OpenRouter) | `lib/ai/ai-sdk-client.ts`, `lib/ai/openrouter.ts` | Unified model routing via Vercel AI SDK + OpenRouter |
| Model router | `lib/ai/model-router.ts` | Allowlist validation, getModel(), task→model mapping |
| Model catalog | `lib/ai/openrouter-model-catalog.ts` | Dynamic OpenRouter catalog, cost estimates, tier defaults |
| ClaimsOS | `lib/claims/` | LangGraph claim validation pipeline |
| Agents | `lib/agents/` | Multi-agent orchestration (campaign, research, compliance) |
| URL Import | `lib/import/` | Extract brand, claims, design from URLs |
| Templates | `lib/templates/` | Template RAG with pgvector semantic search |
| Visual Editor | `components/editor/` | Visual website editor (Preview/Design/Code modes) |
| Sako Escalation | `lib/sako/` | Human designer escalation workflow |
| Billing | `lib/billing/` | Stripe subscriptions + AI credit wallet |

## Code Conventions

### TypeScript
- **No `any` type** — use `unknown` with type guards
- Named exports preferred over default exports for functions
- Explicit return types on exported functions
- Zod validation for all API route inputs

### React / Next.js 16
- Server Components are the default (no `'use client'` unless interactivity is needed)
- `useActionState` for forms, `useOptimistic` for optimistic updates
- Server Actions for mutations

### Imports
```ts
// 1. External packages
// 2. Internal aliases (@/)
// 3. Relative imports
```

### Path alias
`@/*` maps to project root (configured in `tsconfig.json`)

## Hard Rules

1. **Never use `any`** — use `unknown` + narrowing
2. **Never import AI SDKs directly** — always use `lib/ai/ai-sdk-client.ts`
3. **Never edit applied migration files** — create new ones in `supabase/migrations/`
4. **Never delete tests** — fix the code instead
5. **Never use non-allowlisted model IDs** — see `.cursor/rules/latest-models-only.mdc`
6. **Minimal diffs** — don't refactor adjacent code unless asked

## Protected Areas (Ask Before Modifying)

- `lib/claims/validation-graph.ts` — ClaimsOS core (compliance critical)
- `lib/agents/` — Agent orchestration (complex state)
- `lib/billing/` — Stripe integration (financial critical)
- `middleware.ts` — Affects all routes
- `supabase/migrations/` (existing files) — Data integrity

## Quality Gate

Run before completing any task:
```bash
bun lint && bun run test:run
```

## Vitest Config

Tests live in `tests/` directory. Vitest uses Node environment with globals enabled. The `@/` alias is configured in `vitest.config.ts`.
