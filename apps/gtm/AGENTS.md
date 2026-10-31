# AGENTS Guidelines — Sako Composer

> AI GTM Factory. Compliance-first content generation for marketing teams.

This repository contains a Next.js 16 application. When working on the project interactively with an agent (Cursor, Codex, Devin, etc.) follow the guidelines below so that development experience—in particular Hot Module Replacement (HMR)—continues to work smoothly.

---

## 1. Use the Development Server, **not** `bun run build`

- **Always use `bun dev`** while iterating on the application. This starts Next.js in development mode with hot-reload enabled.
- **Do _not_ run `bun run build` inside the agent session.** Running the production build command switches the `.next` folder to production assets which disables hot reload and can leave the development server in an inconsistent state.
- If a production build is required, do it outside of the interactive agent workflow.

---

## 2. Useful Commands

| Command | Purpose |
|---------|---------|
| `bun install` | Install dependencies |
| `bun dev` | Start the Next.js dev server with HMR |
| `bun lint` | Run ESLint checks |
| `bun run test` | Execute the canonical Vitest unit/integration suite |
| `bun run test:e2e` | Execute the Playwright browser suite |
| `bun build` | **Production build – _do not run during agent sessions_** |

---

## 3. Project Structure

```
app/               # Next.js 16 App Router
  api/             # 100+ route handlers
  (app)/           # Protected routes (authenticated)
  (auth)/          # Auth routes (Supabase Auth)
lib/               # Core logic
  ai/              # AI SDK client + gateway routing
  claims/          # ClaimsOS validation (LangGraph)
  agents/          # Multi-agent orchestration
  supabase/        # Supabase clients (server/client/service)
components/        # UI components (shadcn/ui)
supabase/migrations/  # Database migrations with RLS
```

---

## 4. Tech Stack

- **Framework:** Next.js 16.1 (App Router)
- **Language:** TypeScript 5.7 (strict mode)
- **UI:** React 19, Tailwind 4.0, shadcn/ui
- **Database:** Supabase (Postgres + RLS)
- **Auth:** Supabase Auth
- **AI:** Vercel AI SDK 6.x via OpenRouter (`lib/ai/ai-sdk-client.ts`, `lib/ai/openrouter.ts`, `lib/ai/model-router.ts`)
- **Orchestration:** LangGraph 1.x
- **Jobs:** Trigger.dev v3

---

## 5. Code Style

```tsx
// ✅ Named exports, explicit types
export const fetchBrand = async (id: string): Promise<Brand | null> => {
  // implementation
}

// ✅ Server Components default (Next.js 16)
export default async function Page() {
  // server component
}

// ✅ Zod validation for API routes
const schema = z.object({ brandId: z.string().uuid() })

// ❌ NEVER use any
const x: any = ...

// ❌ NEVER import AI SDKs directly
import Anthropic from '@anthropic-ai/sdk'
```

---

## 6. Non-Negotiables

1. **No secrets in code** — Use environment variables only
2. **No `any` types** — Use `unknown` + type narrowing
3. **No test deletion** — Fix the root cause, not the test
4. **No direct AI SDK imports** — Use `lib/ai/ai-sdk-client.ts`
5. **No editing applied migrations** — Create new migration files
6. **Minimal diffs** — Don't refactor code that wasn't asked for

---

## 7. Boundaries (Ask First)

These areas require explicit user approval before modifying:

- `app/(auth)/` — Supabase Auth flows
- `lib/claims/validation-graph.ts` — ClaimsOS core
- `lib/agents/` — Agent orchestration
- `lib/billing/` — Stripe/billing logic
- `supabase/migrations/` — Existing applied migrations

---

## 8. Keep Dependencies in Sync

If you add or update dependencies:

1. Update `bun.lockb` lockfile
2. Re-start the development server so Next.js picks up changes
3. Verify the dev server runs without errors

---

## 9. Skills and Subagents Available

**Skills** in `.cursor/skills/` load dynamically when relevant:
- `ai-routing` — Model allowlist, gateway patterns
- `supabase-rls` — RLS policies, migration patterns
- `compliance` — ClaimsOS validation, claim states
- `ux-system` — UX flow design, state machines
- `frontend-design` — Visual aesthetics, component patterns

**Subagents** in `.cursor/agents/` run in isolated contexts:
- `verifier` — Validates claimed work actually functions
- `test-runner` — Runs tests, fixes failures

---

## 10. Quality Gate

Before finishing any task:

```bash
bun lint && bun run test
```

---

Following these practices ensures that the agent-assisted development workflow stays fast and dependable. When in doubt, restart the dev server rather than running the production build.
