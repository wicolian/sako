# Sako Composer — The AI GTM Factory

> **Compliance-first AI GTM workspace.** Import brand context, generate assets, validate claims with evidence, edit, and export/publish with explicit capability limits.

![Version](https://img.shields.io/badge/version-2.0.0-blue)
![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black)
![AI SDK](https://img.shields.io/badge/Vercel%20AI%20SDK-6.x-purple)
![LangGraph](https://img.shields.io/badge/LangGraph-1.x-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)
![Bun](https://img.shields.io/badge/Bun-1.3.6-orange)
![License](https://img.shields.io/badge/license-Private-red)

<p align="center">
  <img src="./public/favicon.svg" alt="Sako Composer Logo" width="120" height="120">
</p>

---

## 📋 Table of Contents

1. [What is Sako Composer?](#-what-is-sako-composer)
2. [Key Differentiators](#-key-differentiators)
3. [Complete Feature Set](#-complete-feature-set)
4. [Tech Stack (January 2026)](#-tech-stack-january-2026)
5. [Getting Started](#-getting-started)
6. [Environment Variables](#-environment-variables)
7. [Project Structure](#-project-structure)
8. [User Guide](#-user-guide)
9. [API Reference](#-api-reference)
10. [Database Schema](#-database-schema)
11. [Deployment](#-deployment)
12. [Testing](#-testing)
13. [Contributing](#-contributing)
14. [License](#-license)

---

## 🎯 What is Sako Composer?

Sako Composer is a **vertical AI platform for Go-to-Market teams**. Unlike generic AI tools that just generate text, Sako Composer is a complete marketing operations system that:

### Current Product Direction (2026)

1. **You paste your URL** → AI extracts your brand, voice, claims, and evidence
2. **AI generates core assets** → Landing pages, social, decks, and emails from shared brand context
3. **Built-in compliance** → Claims are scored, linked to evidence, and can block export/publish
4. **Channel delivery modes** → Some providers support direct deploy, others are export-only
5. **Learning loop in progress** → Edit/export telemetry is collected to improve future generation

### Who It's For

- **B2B SaaS Marketing Teams** — Generate compliant campaigns at scale
- **Agencies** — White-label campaign generation for clients
- **Growth Teams** — Generate campaigns and review early analytics while A/B testing remains beta
- **Compliance-Heavy Industries** — Finance, healthcare, legal marketing

---

## 🏆 Key Differentiators

### vs. ChatGPT, Claude, or Generic AI

| Sako Composer | Generic AI |
|---------------|-----------|
| **Compliance guardrails** prevent risky claims | No compliance awareness |
| **206 curated templates** ensure on-brand designs | Generic outputs every time |
| **Truthful capability tiers** (direct deploy vs export-only) | Opaque integration behavior |
| **Performance tracking** learns what converts | No learning loop |
| **Evidence linking** backs up every claim | Unverified claims |

### vs. HubSpot, Mailchimp Marketing Platforms

| Sako Composer | Traditional Platforms |
|---------------|----------------------|
| **AI-native** — generation is core | AI is a bolt-on afterthought |
| **Cross-platform** — deploy where supported, export elsewhere | Locked to one ecosystem |
| **Claim validation** built-in | No compliance features |
| **Human escalation** to designers | DIY or expensive agencies |

### vs. Canva, Figma Design Tools

| Sako Composer | Design Tools |
|---------------|-------------|
| **Marketing-specific** workflows | General-purpose design |
| **Compliance-first** generation | No marketing context |
| **Full-stack assets** (pages, emails, ads) | Single asset focus |
| **AI-powered** end-to-end | Manual design process |

---

## ✨ Complete Feature Set

### 🚀 Campaign Builder

Create multi-asset marketing campaigns with AI assistance:

| Feature | Description | Location |
|---------|-------------|----------|
| **AI Message Builder** | Generate headlines, CTAs, body copy with 2026 AI models | `app/(app)/campaigns/[id]/page.tsx` |
| **Marketing Angles** | Generate multiple angles with AI-predicted trust scores | `lib/ai/ai-sdk-client.ts` |
| **Visual Page Builder** | Drag-and-drop landing page construction | `app/(app)/playground/page.tsx` |
| **Email Sequences** | Multi-step drip campaigns with timing controls | `app/(app)/campaigns/[id]/emails/page.tsx` |
| **Sales Deck Generator** | Auto-generate PPTX presentations | `lib/assets/deck-generator.ts` |
| **Social Post Generator** | Platform-optimized social content | `lib/assets/social-generator.ts` |
| **Video Script Generator** | Scene-by-scene scripts with voiceover text | `lib/assets/video-script-generator.ts` |

### 🛡️ ClaimsOS — Compliance Engine

The industry's most sophisticated marketing compliance system:

| Feature | Description | Location |
|---------|-------------|----------|
| **Policy-Based Validation** | Configurable rules for superlatives, regulated terms | `lib/claims/rules-engine.ts` |
| **LangGraph Pipeline** | Multi-step validation with state management | `lib/claims/validation-graph.ts` |
| **Evidence Linking** | Attach proof (URLs, docs, metrics) to claims | `lib/import/evidence-linker.ts` |
| **Risk Scoring** | 0-100 risk score with suggested rewrites | `lib/ai/ai-sdk-client.ts` → `quickClaimCheck()` |
| **Audit Trail** | Full history of changes, approvals, policy versions | `lib/audit/audit-logger.ts` |
| **Policy Templates** | Pre-built policies for industries | `lib/claims/policy-templates.ts` |

### 🎨 Self-Improving Design System

A template library that learns and improves:

| Feature | Description | Location |
|---------|-------------|----------|
| **206 HTML Templates** | Curated high-converting designs | `lib/templates/` |
| **Template RAG** | Semantic search for templates by style/industry | `lib/templates/search.ts` |
| **Quality Scoring** | Track which designs get accepted/rejected | `lib/learning/feedback-loop.ts` |
| **Learning Loop** | Promote winning designs, demote losers | `lib/learning/quality-metrics.ts` |
| **Brand Context** | Auto-apply colors, fonts, voice | `lib/ai/brand-context.ts` |
| **Template Ingestion** | Import HTML templates into vector DB | `scripts/ingest-templates.ts` |

### 🎨 Aura Visual Website Editor

Professional website design and publishing system:

| Feature | Description | Location |
|---------|-------------|----------|
| **Visual Editor** | Three-mode editor: Preview, Design, Code | `components/editor/editor-shell.tsx` |
| **Live Preview** | Real-time iframe preview with viewport switching | `components/editor/preview-mode.tsx` |
| **Design Mode** | Drag-and-drop section editing with overlays | `components/editor/design-mode.tsx` |
| **Code Mode** | Monaco editor for HTML/CSS/JSON editing | `components/editor/code-mode.tsx` |
| **Layers Panel** | Section tree with drag reordering | `components/editor/layers-panel.tsx` |
| **Properties Panel** | Content, style, and theme editing | `components/editor/properties-panel.tsx` |
| **HTML Export** | Generate standalone HTML files | `lib/export/html-exporter.ts` |
| **ZIP Bundling** | Package websites with CSS and assets | `lib/export/asset-bundler.ts` |
| **Subdomain Publishing (Beta)** | Upload hosted artifacts for `*.sako.pub` when DNS is configured | `app/api/publish/route.ts` |
| **Figma Import** | Import designs from Figma URLs | `lib/figma/figma-parser.ts` |
| **Figma Export** | Generate Figma console scripts | `lib/figma/figma-exporter.ts` |
| **Page Transitions** | 12 transition presets (fade, slide, scale) | `lib/website/transitions.ts` |
| **Navigation Builder** | Multi-page navigation with link types | `components/editor/navigation-builder.tsx` |
| **Theme System** | Auto-generate light/dark mode variants | `lib/website/theme-manager.ts` |
| **Components Library** | Browseable UI components with categories | `app/(app)/components/page.tsx` |

### 🎁 Affiliate Program (Partial)

Complete affiliate referral system:

| Feature | Description | Location |
|---------|-------------|----------|
| **Affiliate Dashboard** | Stats, earnings, and tier progress | `app/(app)/affiliate/page.tsx` |
| **Referral Stats** | Clicks, signups, conversions, rates | `components/affiliate/referral-stats.tsx` |
| **Referral Links** | Copy/share links with social integration | `components/affiliate/referral-link.tsx` |
| **Payout History** | Payment tracking and status | `components/affiliate/payout-history.tsx` |
| **Tier System** | Bronze → Silver → Gold → Platinum | `app/(app)/affiliate/page.tsx` |

### 🤝 Real-Time Collaboration

Multi-user collaboration features:

| Feature | Description | Location |
|---------|-------------|----------|
| **Live Cursors** | See collaborator cursors in real-time | `components/canvas/live-cursors.tsx` |
| **Private Chat** | AI-powered private conversations per project | `components/canvas/private-chat.tsx` |
| **Project Sharing** | Email invitations with permission levels | `components/canvas/share-dialog.tsx` |
| **Permissions Manager** | Role-based access control matrix | `components/canvas/permissions-manager.tsx` |
| **Bulk Editor** | Spreadsheet-style multi-asset editing | `components/campaigns/bulk-editor.tsx` |

### 🌐 Brand DNA Dashboard

Centralized brand intelligence:

| Feature | Description | Location |
|---------|-------------|----------|
| **DNA Overview** | Brand summary with logo, tagline, mission | `components/brand-dna/dna-overview.tsx` |
| **Color Palette** | Extracted colors with shade spectrum | `components/brand-dna/color-palette.tsx` |
| **Tone Analyzer** | Voice/tone analysis with do's and don'ts | `components/brand-dna/tone-analyzer.tsx` |
| **Audience Insights** | Target audience with pain points/goals | `components/brand-dna/audience-insights.tsx` |

### 🔬 A/B Testing Framework (Beta)

Statistical rigor for every campaign:

| Feature | Description | Location |
|---------|-------------|----------|
| **Experiment Management** | Create, run, pause, complete experiments | `lib/experiments/ab-testing.ts` |
| **Variant Assignment** | Deterministic visitor bucketing | `lib/experiments/ab-testing.ts` |
| **Event Tracking** | Page views, clicks, conversions, scroll depth | `public/tracking.js` |
| **Statistical Analysis** | Statistical helpers exist; live metrics wiring is still beta | `lib/experiments/ab-testing.ts` |
| **Auto-Winner Detection** | End experiments when significance reached | `app/api/campaigns/[id]/ab-tests/[testId]/winner/route.ts` |
| **A/B Test UI** | Visual test management dashboard | `app/(app)/campaigns/[id]/ab-test/page.tsx` |

### 📊 Campaign Health Monitoring

Real-time campaign status and optimization:

| Feature | Description | Location |
|---------|-------------|----------|
| **Health Score Calculator** | Compliance + freshness + performance score | `lib/health/score-calculator.ts` |
| **Evidence Freshness Checker** | Validate links, check age, detect changes | `lib/health/freshness-checker.ts` |
| **One-Click Refresh** | Re-research evidence, re-validate claims | `lib/refresh/campaign-refresh.ts` |
| **Health Dashboard** | Visual health status with recommendations | `app/(app)/campaigns/[id]/health/page.tsx` |

### 🎬 Video Generation Pipeline

End-to-end video content creation:

| Feature | Description | Location |
|---------|-------------|----------|
| **Video Script Generator** | Scene-by-scene scripts with timing | `lib/assets/video-script-generator.ts` |
| **AI Voiceover** | ElevenLabs integration for narration | `lib/video/voiceover.ts` |
| **Video Assembly** | Creatomate/Shotstack/Remotion rendering | `lib/video/assembly.ts` |
| **Video Editor UI** | Lightweight preview and edit interface | `components/video/video-editor.tsx` |

### 🌐 Magic URL Import

Paste a URL, get everything extracted:

| Feature | Description | Location |
|---------|-------------|----------|
| **URL Fetcher** | Proxy-enabled page fetching with JS rendering | `lib/import/url-fetcher.ts` |
| **HTML Parser** | Extract structured content from pages | `lib/import/html-parser.ts` |
| **Brand Extractor** | Colors, fonts, logos, voice & tone | `lib/import/brand-extractor.ts` |
| **Claims Extractor** | Identify marketing claims from copy | `lib/import/claims-extractor.ts` |
| **Design Extractor** | Extract design tokens and patterns | `lib/import/design-extractor.ts` |
| **Evidence Researcher** | Auto-find supporting evidence online | `lib/import/evidence-researcher.ts` |
| **Evidence Linker** | Match claims to evidence automatically | `lib/import/evidence-linker.ts` |

### 🕵️ Competitor Intelligence

Public data analysis for competitive positioning:

| Feature | Description | Location |
|---------|-------------|----------|
| **Competitor Tracking** | Monitor competitor positioning | `lib/competitors/tracker.ts` |
| **Positioning Analysis** | AI-powered competitive analysis | `lib/competitors/positioning.ts` |
| **Battle Cards** | Generate comparison content | `lib/competitor/intelligence.ts` |
| **Competitor API** | REST endpoints for competitor data | `app/api/competitors/route.ts` |

### 🤖 Agentic AI System (2026 Modernization)

Multi-agent orchestration for complex tasks:

| Feature | Description | Location |
|---------|-------------|----------|
| **Campaign Agent V2** | AI SDK 6 native agent abstraction | `lib/agents/campaign-agent-v2.ts` |
| **Multi-Agent Orchestration** | Specialist agents (research, compliance, creative) | `lib/agents/multi-agent.ts` |
| **MCP Server** | Model Context Protocol for tool integration | `lib/mcp/server.ts` |
| **HITL Workflows** | Human-in-the-loop approval system | `lib/agents/hitl.ts` |
| **AI Wallet** | Credit-based usage tracking | `lib/billing/ai-wallet.ts` |

### 🔌 Provider Integrations

Deploy campaigns anywhere:

| Category | Providers | Location |
|----------|-----------|----------|
| **Marketing Automation** | HubSpot, Salesforce/Pardot, Marketo, ActiveCampaign, Mailchimp, Klaviyo | `lib/providers/*.ts` |
| **Website/CMS** | Webflow, WordPress, Framer, Shopify | `lib/providers/*.ts` |
| **Advertising** | Google Ads, Meta Ads, LinkedIn Ads | `lib/providers/*.ts` |
| **Analytics** | Google Analytics 4, Segment | `lib/providers/analytics.ts` |
| **Collaboration** | Slack, Figma, Notion | `lib/providers/*.ts` |

### 🏢 Enterprise Features

Production-ready for large organizations:

| Feature | Description | Location |
|---------|-------------|----------|
| **SSO/SAML (Coming Soon)** | Enterprise authentication scaffold | `lib/enterprise/sso.ts` |
| **Usage Metering** | Track consumption per workspace | `lib/enterprise/usage-metering.ts` |
| **Audit Logs** | Complete action history with export | `lib/audit/audit-logger.ts` |
| **Role-Based Access** | Owner, admin, editor, viewer roles | `lib/workspace.ts` |
| **API Keys** | Scoped keys for external API access | `app/api/api-keys/route.ts` |

### 👥 Human Escalation (Sako Agency)

When AI isn't enough, escalate to expert designers:

| Feature | Description | Location |
|---------|-------------|----------|
| **Send to Sako** | One-click escalation to designers | `lib/sako/task-manager.ts` |
| **Task Management** | Track escalation status | `lib/sako/task-manager.ts` |
| **Webhook Updates** | Real-time status notifications | `app/api/sako/webhook/route.ts` |
| **Deliverable Import** | Auto-import finished assets | `lib/sako/task-manager.ts` |

---

## 🛠️ Tech Stack (January 2026)

### AI Infrastructure

```
OpenRouter (Unified Model Routing via @openrouter/ai-sdk-provider)
├── Model Allowlist (per .cursor/rules/latest-models-only.mdc):
│   ├── OpenAI: gpt-5.2, gpt-5.2-chat
│   ├── Anthropic: claude-sonnet-4.6, claude-opus-4.6
│   ├── Google: gemini-3.1-pro, gemini-3.1-pro-preview
│   ├── DeepSeek: deepseek-v3.2, deepseek-v3.2-thinking
│   ├── xAI: grok-4.1-fast, grok-4
│   ├── Meta: llama-4-maverick, llama-4-scout
│   └── Moonshot: kimi-k2.5, kimi-k2, kimi-k2-thinking
├── Vercel AI SDK 6.x (model abstraction layer)
├── LangGraph 1.x (Agentic state machines & compliance pipelines)
├── LangChain 1.x (Chain composition)
└── Embeddings: openai/text-embedding-3-large
```

### Core Framework

```
Next.js 16.1.1 (App Router, React 19, Turbopack)
TypeScript 5.7
Tailwind CSS 4.0 + shadcn/ui
Framer Motion 11+ (Fluid animations)
Radix UI (Accessible components)
Bun 1.3.6 (Runtime, package manager, bundler)
```

### Database & Auth

```
Supabase (Production-grade Postgres)
├── Row Level Security (RLS) Enforcement
├── Auth (JWT + Multi-tenant Workspace architecture)
├── pgvector (Vector search for Template RAG)
└── Storage (Media assets, exports)
```

### Payments & Background Jobs

```
Stripe (subscriptions + usage billing)
Trigger.dev v3 (background processing)
```

### Video Pipeline

```
ElevenLabs (AI voiceovers)
Creatomate / Shotstack / Remotion (video rendering)
```

---

## 🚀 Getting Started

### Prerequisites

- **Bun 1.3.6+** (runtime, package manager, bundler)
- **Supabase account** (free tier works for development)
- **OpenRouter API key** (required for AI features; see `.cursor/rules/latest-models-only.mdc`)

### 1. Clone and Install

```bash
git clone https://github.com/your-org/sako-composer-gtm.git
cd sako-composer-gtm
bun install
```

### 2. Set Up Environment

```bash
cp .env.example .env.local
```

Edit `.env.local` with your credentials (see [Environment Variables](#-environment-variables) section).

### 3. Set Up Supabase

#### Option A: Use Supabase CLI (Recommended)

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Push migrations
supabase db push
```

#### Option B: Manual Migration

Run each migration file in `supabase/migrations/` in order (001-024) using the Supabase SQL editor.

### 4. Ingest Design Templates (Optional)

If you have HTML templates to import:

```bash
npm run ingest-templates /path/to/your/templates
```

### 5. Run Development Server

```bash
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 6. Create Your First User

1. Navigate to `/signup`
2. Create an account with email/password
3. You'll be redirected to `/onboarding`
4. Create your workspace and optionally import your brand from a URL
5. Start creating campaigns!

---

## 🔑 Environment Variables

### Required Variables

These must be set for the app to function:

```env
# Supabase [REQUIRED]
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenRouter [REQUIRED for AI features]
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_DYNAMIC_MODELS=true
```

### Optional Variables

Enable additional features:

```env
# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional AI / providers
ANTHROPIC_API_KEY=sk-ant-...

# Evidence Research
TAVILY_API_KEY=...           # Auto evidence research

# Video Generation
ELEVENLABS_API_KEY=...       # AI voiceovers
CREATOMATE_API_KEY=...       # Video rendering
SHOTSTACK_API_KEY=...        # Alternative video rendering

# Competitor Intelligence
G2_API_KEY=...               # G2 competitor data

# Integrations
HUBSPOT_CLIENT_ID=...
HUBSPOT_CLIENT_SECRET=...
WEBFLOW_CLIENT_ID=...
WEBFLOW_CLIENT_SECRET=...
CODE_TO_DESIGN_API_KEY=...   # Figma export

# Human Escalation
SAKO_V1_API_URL=https://api.trysako.com
SAKO_V1_API_KEY=...

# Billing
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
```

---

## 📁 Project Structure

```
sako-composer-gtm/
├── app/                              # Next.js App Router
│   ├── (app)/                        # Authenticated app routes
│   │   ├── page.tsx                  # Dashboard home
│   │   ├── campaigns/                # Campaign management
│   │   │   ├── page.tsx              # Campaign list
│   │   │   ├── new/page.tsx          # Create campaign
│   │   │   └── [id]/                 # Campaign detail
│   │   │       ├── page.tsx          # Campaign editor
│   │   │       ├── ab-test/page.tsx  # A/B testing
│   │   │       ├── assets/page.tsx   # Asset management
│   │   │       ├── emails/page.tsx   # Email sequence editor
│   │   │       ├── health/page.tsx   # Health dashboard
│   │   │       └── refresh/page.tsx  # Campaign refresh
│   │   ├── claims/                   # ClaimsOS library
│   │   ├── evidence/                 # Evidence library
│   │   ├── playground/               # Visual page builder
│   │   ├── agent/                    # AI agent chat
│   │   ├── analytics/                # Usage & performance
│   │   ├── competitors/              # Competitor intelligence
│   │   ├── compliance/               # Compliance dashboard
│   │   ├── import/                   # URL import wizard
│   │   ├── onboarding/               # User onboarding
│   │   ├── reviews/                  # Approval queue
│   │   ├── settings/                 # Workspace settings
│   │   └── admin/                    # Admin dashboard
│   │
│   ├── api/                          # API Routes
│   │   ├── agent/                    # AI agent endpoints
│   │   ├── ai/                       # AI generation
│   │   ├── analytics/                # Analytics tracking
│   │   ├── approvals/                # Approval workflows
│   │   ├── campaigns/                # Campaign CRUD + generation
│   │   ├── claims/                   # Claim validation
│   │   ├── competitors/              # Competitor data
│   │   ├── evidence/                 # Evidence management
│   │   ├── experiments/              # A/B testing
│   │   ├── import/                   # URL import
│   │   ├── providers/                # Integration management
│   │   ├── sako/                     # Human escalation
│   │   ├── video/                    # Video generation
│   │   ├── wallet/                   # AI credits
│   │   └── v1/                       # Public API
│   │
│   ├── login/page.tsx                # Login page
│   ├── signup/page.tsx               # Signup page
│   └── share/[token]/page.tsx        # Public share pages
│
├── lib/                              # Core business logic
│   ├── ai/                           # AI SDK & prompts
│   │   ├── ai-sdk-client.ts          # Vercel AI SDK integration
│   │   ├── prompts.ts                # Original prompts
│   │   ├── prompts-v2.ts             # 2026 modernized prompts
│   │   ├── brand-context.ts          # Brand context builder
│   │   ├── langchain-client.ts       # LangChain integration
│   │   ├── multi-asset.ts            # Multi-asset generation
│   │   ├── rate-limiter.ts           # Circuit breaker
│   │   ├── template-aware-generation.ts # Template RAG
│   │   ├── tracing.ts                # Cost tracking
│   │   └── validators.ts             # Input validation
│   │
│   ├── agents/                       # Agentic AI
│   │   ├── campaign-agent.ts         # Original agent
│   │   ├── campaign-agent-v2.ts      # AI SDK 6 agent
│   │   ├── multi-agent.ts            # Multi-agent orchestration
│   │   ├── hitl.ts                   # Human-in-the-loop
│   │   ├── state.ts                  # Agent state management
│   │   └── steps/                    # Agent steps
│   │
│   ├── claims/                       # ClaimsOS
│   │   ├── validation-graph.ts       # LangGraph pipeline
│   │   ├── rules-engine.ts           # Rule evaluation
│   │   ├── policy-templates.ts       # Industry policies
│   │   └── types.ts                  # Type definitions
│   │
│   ├── templates/                    # Template RAG
│   │   ├── search.ts                 # Semantic search
│   │   ├── ingestion.ts              # Template import
│   │   └── types.ts                  # Type definitions
│   │
│   ├── import/                       # URL Import
│   │   ├── url-fetcher.ts            # Page fetching
│   │   ├── html-parser.ts            # HTML parsing
│   │   ├── brand-extractor.ts        # Brand extraction
│   │   ├── claims-extractor.ts       # Claim extraction
│   │   ├── design-extractor.ts       # Design extraction
│   │   ├── evidence-researcher.ts    # Evidence research
│   │   └── evidence-linker.ts        # Evidence linking
│   │
│   ├── providers/                    # Provider adapters and capability registry
│   │   ├── hubspot.ts
│   │   ├── webflow.ts
│   │   ├── wordpress.ts
│   │   ├── google-ads.ts
│   │   ├── meta-ads.ts
│   │   └── ... (15 more)
│   │
│   ├── video/                        # Video Pipeline
│   │   ├── voiceover.ts              # ElevenLabs
│   │   ├── assembly.ts               # Video rendering
│   │   └── elevenlabs.ts             # ElevenLabs client
│   │
│   ├── assets/                       # Asset Generators
│   │   ├── deck-generator.ts         # PPTX generation
│   │   ├── social-generator.ts       # Social posts
│   │   └── video-script-generator.ts # Video scripts
│   │
│   ├── export/                       # Export System
│   │   ├── html-exporter.ts          # Generate HTML
│   │   ├── css-generator.ts          # Generate CSS
│   │   └── asset-bundler.ts          # ZIP bundling
│   │
│   ├── figma/                        # Figma Integration
│   │   ├── figma-client.ts           # Figma API client
│   │   ├── figma-parser.ts           # Convert Figma to sections
│   │   └── figma-exporter.ts         # Export to Figma script
│   │
│   ├── website/                      # Website Builder
│   │   ├── ai-designer.ts            # AI section generation
│   │   ├── transitions.ts            # Page transitions
│   │   └── theme-manager.ts          # Light/dark theming
│   │
│   ├── health/                       # Campaign Health
│   │   ├── score-calculator.ts       # Health scoring
│   │   └── freshness-checker.ts      # Link validation
│   │
│   ├── refresh/                      # Campaign Refresh
│   │   └── campaign-refresh.ts       # One-click refresh
│   │
│   ├── competitors/                  # Competitor Intelligence
│   │   ├── tracker.ts
│   │   └── positioning.ts
│   │
│   ├── experiments/                  # A/B Testing
│   │   └── ab-testing.ts
│   │
│   ├── billing/                      # Billing
│   │   ├── plans.ts                  # Plan definitions
│   │   ├── usage.ts                  # Usage tracking
│   │   └── ai-wallet.ts              # AI credits
│   │
│   ├── enterprise/                   # Enterprise Features
│   │   ├── sso.ts                    # SSO/SAML
│   │   └── usage-metering.ts         # Usage limits
│   │
│   ├── audit/                        # Audit Logging
│   │   └── audit-logger.ts
│   │
│   ├── learning/                     # Self-Improving RAG
│   │   ├── feedback-loop.ts
│   │   └── quality-metrics.ts
│   │
│   ├── sako/                         # Human Escalation
│   │   └── task-manager.ts
│   │
│   ├── mcp/                          # MCP Server
│   │   └── server.ts
│   │
│   └── supabase/                     # Database clients
│       ├── client.ts
│       ├── server.ts
│       └── service.ts
│
├── components/                       # React Components
│   ├── ui/                           # shadcn/ui components
│   ├── playground/                   # Page builder components
│   ├── campaigns/                    # Campaign components
│   ├── video/                        # Video editor
│   ├── editor/                       # Aura visual editor
│   │   ├── editor-shell.tsx          # Main editor component
│   │   ├── preview-mode.tsx          # Live preview iframe
│   │   ├── design-mode.tsx           # Visual editing mode
│   │   ├── code-mode.tsx             # Monaco code editor
│   │   ├── layers-panel.tsx          # Section tree
│   │   ├── properties-panel.tsx      # Properties sidebar
│   │   ├── figma-import-dialog.tsx   # Figma import/export
│   │   ├── transition-picker.tsx     # Page transition selector
│   │   ├── navigation-builder.tsx    # Multi-page nav builder
│   │   ├── theme-toggle.tsx          # Theme switcher
│   │   └── theme-preview.tsx         # Theme preview
│   ├── canvas/                       # Collaboration components
│   │   ├── live-cursors.tsx          # Real-time cursor overlays
│   │   ├── private-chat.tsx          # Private AI chat panel
│   │   ├── share-dialog.tsx          # Project sharing modal
│   │   └── permissions-manager.tsx   # Role-based permissions
│   ├── affiliate/                    # Affiliate dashboard
│   │   ├── referral-stats.tsx        # Earnings statistics
│   │   ├── referral-link.tsx         # Share link component
│   │   └── payout-history.tsx        # Payment history
│   ├── brand-dna/                    # Brand DNA dashboard
│   │   ├── dna-overview.tsx          # Brand summary card
│   │   ├── color-palette.tsx         # Color visualization
│   │   ├── tone-analyzer.tsx         # Voice/tone analysis
│   │   └── audience-insights.tsx     # Audience card
│   ├── library/                      # Component library
│   │   ├── component-card.tsx        # Component preview card
│   │   └── component-browser.tsx     # Browse components
│   └── ...
│
├── supabase/
│   └── migrations/                   # Database migrations (001-024)
│
├── scripts/
│   ├── ingest-templates.ts           # Template ingestion
│   └── migrate-templates.ts          # Template migration
│
├── __tests__/
│   ├── evals/                        # AI prompt evals
│   └── integration/                  # Integration tests
│
├── public/
│   └── tracking.js                   # A/B test tracking script
│
├── .cursor/rules/                    # Cursor AI rules
│   ├── latest-models-only.mdc        # Model allowlist
│   ├── policy-repo.mdc               # Repo standards
│   └── frontend.mdc                  # Frontend guidelines
│
├── .env.example                      # Environment template
├── package.json
├── tsconfig.json
└── README.md
```

---

## 📖 User Guide

### User Flow Overview

```
1. SIGNUP → 2. ONBOARDING → 3. DASHBOARD → 4. CREATE CAMPAIGN → 5. GENERATE → 6. DEPLOY
                  ↓
            Import Brand URL
                  ↓
         Extract Brand + Claims
                  ↓
           Research Evidence
```

### Step 1: Sign Up

1. Navigate to `/signup`
2. Enter email and password
3. Verify your email (if enabled)
4. You'll be redirected to onboarding

### Step 2: Onboarding

The onboarding wizard helps you set up your workspace:

1. **Create Workspace** — Name your workspace (e.g., "Acme Marketing")
2. **Import Brand (Optional)** — Paste your website URL to auto-extract:
   - Brand colors, fonts, logos
   - Voice & tone attributes
   - Existing marketing claims
   - Supporting evidence
3. **Complete Setup** — Start using the platform

### Step 3: Dashboard

The dashboard shows:
- **Campaign count** — Active campaigns
- **Compliance score** — Overall claim health
- **Recent activity** — Latest changes
- **Quick actions** — Create campaign, import URL

### Step 4: Create Campaign

1. Click "New Campaign"
2. Fill in campaign details:
   - **Name** — Campaign identifier
   - **Audience** — Who you're targeting
   - **Goal** — What you want to achieve
   - **Offer** — What you're promoting
   - **CTA** — Call to action
3. Click "Generate Campaign"

### Step 5: AI Generation

The system generates multiple assets:

1. **Landing Page**
   - Hero section with headline, subheadline, CTA
   - Features/benefits section
   - Social proof/testimonials
   - FAQ section
   - Final CTA

2. **Marketing Angles**
   - 3-5 different positioning approaches
   - AI trust scores for each angle
   - Evidence citations

3. **Email Sequence**
   - Welcome email
   - Value proposition emails
   - Social proof email
   - Urgency/scarcity email
   - Final CTA email

4. **Sales Deck**
   - Title slide
   - Problem/opportunity
   - Solution overview
   - Features/benefits
   - Social proof
   - Call to action

5. **Social Posts**
   - LinkedIn posts
   - Twitter/X posts
   - Facebook posts

6. **Video Script** (if enabled)
   - Scene-by-scene breakdown
   - Voiceover text
   - Visual suggestions
   - Timing cues

### Step 6: Review & Deploy

1. **Review Claims**
   - Each claim shows a risk level (low/medium/high)
   - High-risk claims can be rewritten or linked to evidence
   - Approve all claims before deployment

2. **Edit Content**
   - Use the visual editor to modify content
   - Drag-and-drop sections
   - Edit text inline
   - Change images

3. **Deploy**
   - Select deployment target (HubSpot, Webflow, etc.)
   - Configure settings
   - Click Deploy
   - Monitor deployment status

### Using the Evidence Library

Evidence supports your marketing claims:

1. **Auto-Research** — During campaign creation, AI searches for supporting evidence
2. **Manual Add** — Add your own evidence (case studies, testimonials, data)
3. **Link to Claims** — Connect evidence to specific claims
4. **Freshness Check** — Monitor evidence age and link validity

### Using A/B Testing

1. **Create Experiment** — Select campaign, define variants
2. **Configure Traffic Split** — Set percentage per variant
3. **Add Tracking** — Embed tracking.js on deployed pages
4. **Monitor Results** — View real-time metrics
5. **Declare Winner** — When statistically significant

### Escalating to Sako Agency

When AI-generated content needs professional polish:

1. Click "Send to Sako" on any campaign
2. Select urgency level
3. Add notes for designers
4. Submit task
5. Track progress via webhook updates
6. Import deliverables when complete

---

## 🔌 API Reference

### Authentication

All API requests require authentication via:

1. **Session Cookie** — For browser-based access
2. **API Key** — For programmatic access

```http
GET /api/campaigns
X-API-Key: your-api-key
```

### Campaign APIs

```http
# List campaigns
GET /api/campaigns

# Create campaign
POST /api/campaigns
{
  "name": "Q1 Launch",
  "audience": "B2B SaaS founders",
  "goal": "Generate demo signups",
  "offer": "Free 14-day trial",
  "cta": "Start Free Trial"
}

# Get campaign
GET /api/campaigns/{id}

# Update campaign
PATCH /api/campaigns/{id}

# Delete campaign
DELETE /api/campaigns/{id}

# Generate campaign assets
POST /api/campaigns/{id}/generate

# Get campaign health
GET /api/campaigns/{id}/health

# Refresh campaign
POST /api/campaigns/{id}/refresh
```

### Claim Validation APIs

```http
# Quick claim check
POST /api/claims/validate
{
  "claim": "We're the #1 solution"
}

# Batch validation
POST /api/claims/validate/batch
{
  "claims": ["Claim 1", "Claim 2"],
  "policyId": "default"
}

# Public API (requires API key)
POST /api/v1/validate
X-API-Key: your-api-key
{
  "claims": ["Claim 1", "Claim 2"],
  "policyId": "default"
}
```

### Evidence APIs

```http
# List evidence
GET /api/evidence

# Add evidence
POST /api/evidence
{
  "title": "Customer Case Study",
  "content": "...",
  "sourceUrl": "https://...",
  "sourceType": "case_study"
}

# Check freshness
POST /api/evidence/freshness
{
  "campaignId": "..."
}
```

### A/B Testing APIs

```http
# Create experiment
POST /api/experiments
{
  "campaignId": "...",
  "name": "Headline Test",
  "variants": [
    { "name": "Control", "weight": 50 },
    { "name": "Variant A", "weight": 50 }
  ]
}

# Get variant for visitor
GET /api/experiments/{id}/track?visitorId=xxx

# Track event
POST /api/experiments/{id}/track
{
  "variantId": "variant_xxx",
  "eventType": "conversion",
  "conversionValue": 99.99
}
```

### AI Agent APIs

```http
# Run agent
POST /api/agent
{
  "message": "Create a landing page for enterprise buyers"
}

# Run agent with orchestration
POST /api/agent/run
{
  "agentType": "campaign",
  "input": {
    "brief": "Create a campaign...",
    "workspaceId": "..."
  }
}
```

### Video APIs

```http
# Generate video script
POST /api/video/script
{
  "campaignId": "...",
  "format": "16:9",
  "duration": 60,
  "style": "professional"
}

# Generate voiceover
POST /api/video/generate-voiceover
{
  "text": "...",
  "voiceId": "optional"
}

# Assemble video
POST /api/video/assemble
{
  "scriptId": "...",
  "voiceoverUrl": "..."
}
```

---

## 📊 Database Schema

### Core Tables

| Table | Description |
|-------|-------------|
| `workspaces` | Multi-tenant workspaces |
| `workspace_members` | User-workspace memberships |
| `brands` | Brand configurations |
| `campaigns` | Campaign records |
| `messages` | Generated marketing messages |
| `angles` | Marketing angles with trust scores |
| `page_blocks` | Landing page sections |
| `campaign_assets` | Generated assets (decks, videos, etc.) |

### ClaimsOS Tables

| Table | Description |
|-------|-------------|
| `claims` | Marketing claim records |
| `evidence` | Evidence library |
| `claim_evidence` | Claim-evidence links |
| `policies` | Compliance policies |
| `policy_versions` | Policy version history |

### Compliance Tables

| Table | Description |
|-------|-------------|
| `audit_logs` | Complete action history |
| `approval_requests` | Pending approvals |
| `api_keys` | External API keys |

### A/B Testing Tables

| Table | Description |
|-------|-------------|
| `experiments` | A/B test configurations |
| `experiment_variants` | Test variants |
| `experiment_events` | Tracking events |

### Enterprise Tables

| Table | Description |
|-------|-------------|
| `subscriptions` | Stripe subscriptions |
| `usage_records` | Usage tracking |
| `workspace_wallets` | AI credit balances |
| `ai_traces` | AI call logs with costs |

---

## 🚢 Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
bun add -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
```

**Note:** Vercel automatically detects `bun.lockb` and uses Bun for builds.

### Environment Variables on Vercel

Set all variables from `.env.example` in your Vercel project settings:
- Project Settings → Environment Variables
- Add each variable for Production, Preview, and Development

### Background Jobs with Trigger.dev

```bash
# Install Trigger.dev CLI
bun add -g @trigger.dev/cli

# Initialize
bun x trigger.dev init

# Deploy jobs
bun x trigger.dev deploy
```

### Database Migrations

When deploying to production:

```bash
# Using Supabase CLI
supabase db push --linked

# Or run migrations manually in Supabase dashboard
```

---

## 🧪 Testing

### Run Tests

```bash
# Run the canonical unit/integration suite
bun run test

# Run the canonical suite in watch mode
bunx vitest --config vitest.config.ts

# Run a specific Vitest file
bunx vitest run path/to/test.ts

# Run browser E2E tests
bun run test:e2e

# List browser E2E tests without executing them
bun run test:e2e --list

# Run AI eval tests (requires OPENROUTER_API_KEY)
bun run test:evals
```

### Test Structure

```
__tests__/
├── evals/
│   └── prompt-evals.eval.ts    # AI prompt quality evals (live-key gated)
└── integration/
    ├── campaign.test.ts        # Campaign flow tests
    ├── deploy.test.ts          # Deployment tests
    └── video.test.ts           # Video pipeline tests

tests/
├── flow-compiler.test.ts       # Flow compiler tests
├── validators.test.ts          # Validator tests
└── e2e/                        # Playwright browser tests (.e2e.ts)
```

### Linting

```bash
# Run ESLint
bun run lint

# Fix auto-fixable issues
bun run lint:fix
```

---

## 🔒 Security

### Data Protection

- **Encryption at rest** — All provider tokens encrypted with AES-256
- **Row Level Security** — All Supabase tables have RLS policies
- **HMAC verification** — Webhook signatures validated
- **API key scoping** — Keys scoped to specific permissions

### Authentication

- **Supabase Auth** — JWT-based authentication
- **Session management** — Secure cookie handling
- **Multi-tenant isolation** — Workspace-level data isolation

### Compliance

- **Audit logging** — All actions logged for compliance
- **Data retention** — Configurable retention policies
- **Export capabilities** — Full data export for GDPR

---

## 🤝 Contributing

### Development Workflow

1. Create a feature branch
2. Make changes
3. Run tests: `bun test`
4. Run linting: `bun run lint`
5. Build: `bun run build`
6. Create pull request

### Code Standards

- Follow TypeScript strict mode
- Use ESLint configuration
- Write tests for new features
- Update documentation

### Commit Messages

```
feat: Add new feature
fix: Fix bug
docs: Update documentation
style: Code style changes
refactor: Code refactoring
test: Add tests
chore: Maintenance tasks
```

---

## 📄 License

**Private — All rights reserved**

This software is proprietary. Unauthorized copying, distribution, or use is prohibited.

---

## 📚 Additional Documentation

| File | Purpose |
|------|---------|
| [CLAUDE.md](./CLAUDE.md) | Claude Code instructions |
| [AGENTS.md](./AGENTS.md) | AI agent guidelines |
| [infra/README.md](./infra/README.md) | AWS deployment guide |
| [docs/plans/](./docs/plans/) | Active implementation plans (model picker, etc.) |
| [docs/SEND_TO_SAKO_IMPLEMENTATION.md](./docs/SEND_TO_SAKO_IMPLEMENTATION.md) | Send to Sako feature |
| [plans/sako-composer-2026-implementation-plan.md](./plans/sako-composer-2026-implementation-plan.md) | 2026 roadmap (reference) |

---

<p align="center">
  <strong>Sako Composer</strong><br>
  The AI GTM Factory<br>
  <em>Generate. Validate. Deploy. Escalate.</em>
</p>

<p align="center">
  Built with ❤️ for marketing teams who demand more from AI.
</p>
