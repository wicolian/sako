---
trigger: model_decision
description: all policy
---

---
description: "Hard repo standard: Next.js 16 + AI SDK 6 + AI Gateway + agent/tool-first patterns + enforcement checks. Cursor must upgrade legacy usage and add CI guards so regressions cannot merge."
alwaysApply: false
---
# Latest Standards (Jan 2026) - HARD RULE

If code conflicts with this rule, change the code. Do not argue. Do not “keep legacy for now” unless the user explicitly requests it.

This repo is held to:
- Next.js 16.x baseline (App Router). Upgrade any older Next.js usage. (Next 16 is current baseline) 
- AI calls must use Vercel AI SDK 6.x and route through Vercel AI Gateway.
- Agent + tools first. Retrieval is allowed but must be tool-driven and evaluated, not “random RAG glue”.
- MCP is the preferred protocol boundary for tool/data integrations when appropriate.

Sources for these standards:
- AI SDK 6 introduces Agents (reusable agent abstraction with tools) 
- Vercel AI Gateway is a unified API with budgets, monitoring, retries/failover and routing
- MCP is an open protocol for connecting LLM apps to tools/data sources
- Next.js 16 is available and documented (upgrade guide exists)
(See citations in the chat message that introduced this rule.)

---

## 1) Framework + runtime baseline (non-negotiable)

### Next.js
- Must be Next.js 16.x.
- Prefer App Router patterns.
- Do not introduce Pages Router unless explicitly requested.
- Keep Node runtime at >= 20 (unless explicitly constrained).

If repo is on Next 14/15:
- Upgrade to 16 following official upgrade guidance.
- Fix build/runtime issues instead of pinning older versions.

### TypeScript
- Keep strict typing.
- No any-casting to silence errors unless user explicitly asks.

---

## 2) AI architecture baseline (how modern AI apps are built)

### Default pattern: Agent + tools + streaming UI
Build AI features around:
- 1 or more agents (each has model + instructions + toolset)
- tool calls for real actions (DB, retrieval, webhooks, etc.)
- structured outputs where it matters
- streaming for UX (chat, generation, progress)

AI SDK 6 provides an Agent abstraction. Use it when it improves clarity and reuse.

### Routing: use AI Gateway by default
All model calls must go through Vercel AI Gateway (single endpoint) unless explicitly required otherwise.
AI Gateway is used to:
- centralize keys / routing
- track usage/cost
- configure budgets and reliability (retries/failover) where available

Do not wire raw provider SDKs directly unless explicitly requested.

---

## 3) Model allowlist (repo is the source of truth)

This repo uses an allowlist. Do not add random model strings. Do not use legacy families.

### Allowed model IDs (exact strings only)
OpenAI:
- openai/gpt-5.2
- openai/gpt-5.2-chat
- openai/gpt-5.2-pro

Anthropic:
- anthropic/claude-opus-4.5
- anthropic/claude-sonnet-4.5
- anthropic/claude-haiku-4.5

Google:
- google/gemini-3-flash
- google/gemini-3-pro-preview
- google/gemini-3-pro-image

DeepSeek:
- deepseek/deepseek-v3.2
- deepseek/deepseek-v3.2-thinking
- deepseek/deepseek-v3.2-speciale
- deepseek/deepseek-v3.2-exp  # only if explicitly requested

xAI:
- xai/grok-4.1-fast-reasoning
- xai/grok-4.1-fast-non-reasoning
- xai/grok-code-fast-1

Meta:
- meta/llama-4-maverick
- meta/llama-4-scout

Moonshot:
- moonshotai/kimi-k2
- moonshotai/kimi-k2-thinking
- moonshotai/kimi-k2-turbo
- moonshotai/kimi-k2-thinking-turbo

Embeddings:
- openai/text-embedding-3-large
- openai/text-embedding-3-small
- google/gemini-embedding-001
- google/text-embedding-005

Images:
- google/gemini-3-pro-image

### Banned patterns
If you see any of the following in code, replace them:
- gpt-4o / gpt-4 / gpt-3.5
- claude-3.*
- gemini-1.* / gemini-2.*
- any provider model string not listed above

---

## 4) Retrieval vs “agentic” (stop the false dichotomy)

Retrieval is allowed. What is not allowed is dumb “RAG because people said so”.

### Allowed retrieval pattern
- retrieval is a TOOL the agent uses
- retrieval results must be:
  - bounded (top-k, max tokens)
  - cached where practical
  - deduped
  - evaluated (basic regression tests)
  - protected from prompt injection (treat retrieved text as untrusted)

### Not allowed
- building a vector DB + chunking pipeline without a measured need
- “RAG everywhere” design that cannot be tested
- mixing retrieval directly into prompts without boundaries/labels

---

## 5) MCP (Model Context Protocol) guidance

MCP is the preferred integration boundary for tools and external context when:
- multiple tools/sources exist
- you want a standardized tool interface
- you want to decouple tool servers from the app

Use MCP thoughtfully:
- least-privilege tool exposure
- auth and token handling
- tool allowlist
- audit logs
- sanitize any tool outputs that can contain untrusted content

Do NOT introduce MCP if the repo is tiny and the tool surface is 1-2 internal functions.
If MCP is introduced, implement it cleanly and securely.

---

## 6) Reliability + safety (required for production AI)

Any AI endpoint must have:
- timeouts
- retries with backoff (or AI Gateway reliability features if configured)
- rate limiting
- graceful degradation (fallback model or “try again” UX)
- cost visibility (log tokens/cost when available)

Tool safety requirements:
- tool allowlist per agent
- validate tool inputs
- treat all tool outputs as untrusted
- never exfiltrate secrets to model context

---

## 7) Observability + evals (no black boxes)

Required:
- tracing (at least request-id, agent name, model id, latency)
- cost tracking (tokens/cost where available)
- prompt/tool versioning in code (constants or files, not inline mystery strings)
- regression tests for prompts/tools (golden tests or snapshot tests are fine)

If adding an agent/tool, also add:
- a minimal eval harness (even 5-20 golden cases beats nothing)

---

## 8) The enforcement move (Cursor must add guards so regressions can’t merge)

Cursor must implement repo-level checks that fail CI if:
- Next.js major is not 16
- AI SDK major is not 6
- banned model IDs appear anywhere
- non-allowlisted provider/model strings appear
- provider SDK direct calls bypass Gateway (unless explicitly allowed)

### Implementation requirement
Add:
- scripts/policy-check.mjs (scans package.json + code for violations)
- package.json scripts:
  - "policy:check": "node scripts/policy-check.mjs"
  - "ci": "pnpm -s policy:check && pnpm -s typecheck && pnpm -s test"
- CI workflow (GitHub Actions) that runs pnpm ci on PRs

If the user is not using pnpm, match the repo’s package manager.

---

## 9) Definition of done for any change Cursor makes

Before finishing:
- Run policy:check mentally and ensure it would pass
- Ensure all AI calls route via AI Gateway and use allowlist models
- Ensure Next.js is 16.x and build still works
- Ensure no legacy model strings remain
- Add/update tests/evals when touching AI prompts/tools
- Keep code minimal and remove dead legacy paths where safe
