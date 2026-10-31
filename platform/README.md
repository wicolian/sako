# SAKO — Design Operations Platform for B2B SaaS

<div align="center">

**Ship launch-ready landing pages, decks, and GTM assets in 48 hours — without building a large in-house design team.**

[![Version](https://img.shields.io/badge/version-1.0.0--beta-blue.svg)]()
[![Status](https://img.shields.io/badge/status-beta-orange.svg)]()

</div>

---

## What is Sako?

This repo is **Sako OS** – a productized design service platform that powers Sako's design & motion pod:

| App | Description |
|-----|-------------|
| **Client App** | Client-facing dashboard for submitting briefs, tracking tasks, managing brands, and reviewing deliverables |
| **Studio App** | Internal admin dashboard for the design/motion pod to pick up tasks, manage capacity, and deliver work |
| **API** | NestJS backend handling workspaces, billing, credits, tasks, reviews, and the Composer Gateway |

The **Composer app** (AI design workspace for landing pages) lives in a **separate repo** and calls into this OS via the Composer Gateway endpoints.

---

## Product Architecture

| App | Domain | Description |
|-----|--------|-------------|
| **Marketing Site** | trysako.com | Marketing page (separate Next.js repo) |
| **Client App** | app.trysako.com | Client dashboard |
| **Studio App** | studio.trysako.com | Admin/operator dashboard |
| **API (Sako OS)** | api.trysako.com | Backend services + Composer Gateway |
| **Composer** | composer.trysako.com | AI design generator (separate repo) |

---

## Two Ways to Submit Work

Users on Core/Ops/Enterprise plans can choose either path:

### Path A: Composer First (AI-Assisted)
```
Composer → Generate AI draft → Refine → "Send to Sako" → Pod polishes → Delivered
```
Best for: Landing pages where you want control over initial direction.

### Path B: Direct Brief (Human-First)
```
Client App → Submit brief → Pod creates from scratch → Delivered
```
Best for: Motion/video work, complex design, or when you prefer human creativity from the start.

**Both paths are valid.** Motion work always uses Path B since Composer v1 only supports landing pages.

---

## Plans & Pricing

| Feature | Composer Free | Composer Pro | Core | Ops Base | Enterprise |
|---------|---------------|--------------|------|----------|------------|
| **Monthly Price** | Free | $30 | $2,500 | $4,500 | From $8,500 |
| **Annual Price** | Free | $360 | $27,000 | $48,600 | From $91,800 |
| **Active Tasks** | — | — | 1 | 2 | 3+ |
| **Scope** | Design (AI) | Design (AI) | Design + Motion | Design + Motion | Design + Motion + Strategy |
| **AI Credits** | 10/month | 100/month | Unlimited | Unlimited | Unlimited |
| **Team Seats** | — | — | 2 | 4 | 5+ |
| **Studio Access** | No | No | Yes | Yes | Yes |

- **Composer-only plans:** AI generation only, no human fulfillment
- **Studio plans:** Full platform access with human design/motion pod

---

## Features

### ✅ Implemented

| Feature | Location | Description |
|---------|----------|-------------|
| **Client App** | `apps/client` | Dashboard, tasks, brands, settings, billing |
| **Studio App** | `apps/studio` | Admin dashboard, kanban, client management, AI insights |
| **Task Workflow** | `services/api/src/task` | QUEUED → IN_PROGRESS → IN_REVIEW → COMPLETED pipeline |
| **Review Board** | `services/api/src/review`, `packages/review-ui` | Multi-format asset review with annotations |
| **Brand Management** | `services/api/src/brand` | Brand profiles, colors, typography, assets |
| **Stripe Billing** | `services/api/src/stripe` | Subscriptions, checkout, webhooks, plan changes |
| **Subscription Controls** | `services/api/src/subscription` | Pause, resume, cancel with credit preservation |
| **Day Credits** | `services/api/src/credits` | Credit burn scheduler, usage tracking |
| **Global Search** | `services/api/src/search` | Full-text search across tasks and workspaces |
| **Notifications** | `services/api/src/common/notifications` | Email (Resend), in-app, Slack notifications |
| **Slack Integration** | `services/api/src/slack` | OAuth, task notifications, channel sync |
| **Analytics** | `services/api/src/common/analytics` | PostHog integration for product analytics |
| **Clerk Auth** | `services/api/src/auth` | Shared authentication across all apps |
| **48h SLA Tracking** | `services/api/src/common/utils/sla.util.ts` | SLA calculation with pause/resume support |
| **AI Task Estimator** | `services/api/src/task/task-estimator.service.ts` | Complexity estimation, scope flagging |
| **Composer Gateway** | `services/api/src/composer` | SSO, capabilities, brands, "Send to Sako" |
| **Composer SSO** | `services/api/src/composer` | HMAC-signed token for partner authentication |
| **File Storage** | `services/api/src/common/storage` | S3/R2-compatible uploads |
| **WebSocket Updates** | `services/api/src/task/task.gateway.ts` | Real-time task status updates |

### Review Board Asset Types

| Type | Viewer | Annotation Support |
|------|--------|-------------------|
| Images | `ImageViewer.tsx` | Pin annotations (x, y) |
| PDFs | `PDFViewer.tsx` | Page-based pin annotations |
| Videos | `VideoViewer.tsx` | Timestamp comments |
| Lottie | `LottieViewer.tsx` | Frame-based comments |
| Rive | `RiveViewer.tsx` | State/input annotations |
| Figma | `FigmaViewer.tsx` | Embedded iframe |

### Composer Integration

The Composer app (AI landing page generator) lives in a **separate repo** (`sako-composer`) with its own database, but shares authentication and billing with sako-v1.

| Component | sako-v1 (this repo) | sako-composer |
|-----------|---------------------|---------------|
| **Database** | Separate Neon PostgreSQL | Separate Neon PostgreSQL |
| **Clerk Auth** | Shared (same keys) | Shared (same keys) |
| **Stripe Billing** | Source of truth | Proxies to sako-v1 |
| **Brands** | Source of truth | Fetches from sako-v1 API |

**Integration Endpoints:**

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /composer/sso-token` | Clerk JWT | Generate HMAC-signed SSO token for Composer redirect |
| `GET /composer/capabilities` | Clerk JWT | Plan info, credits, feature flags |
| `GET /composer/brands` | Clerk JWT | Brands for logged-in user's workspace |
| `GET /composer/internal/brands/:workspaceId` | HMAC | Server-to-server brand fetch |
| `POST /composer/tasks/from-draft` | Clerk JWT | "Send to Sako" — create Studio task from Composer draft |
| `POST /composer/create-checkout-session` | Clerk JWT | Upgrade flow from Composer |

**SSO Flow:**
```
User clicks "Open Composer" in Client App
  → GET /composer/sso-token (returns HMAC-signed token, 5-min expiry)
  → Redirect to composer.trysako.com?sso_token=xxx
  → Composer exchanges token for session
  → User logged in with unlimited credits + workspace brands
```

**Environment Variables:**
```bash
COMPOSER_HMAC_SECRET=your_shared_secret    # Must match sako-composer's SAKO_OS_HMAC_SECRET
COMPOSER_URL=https://composer.trysako.com  # SSO redirect target
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Vite 6, TypeScript, Tailwind CSS |
| **UI Components** | Radix UI, shadcn/ui patterns, Lucide icons |
| **Backend** | NestJS 10, Prisma 5, PostgreSQL |
| **Auth** | Clerk (shared across apps) |
| **Billing** | Stripe (subscriptions, checkout) |
| **Storage** | S3/R2-compatible (Cloudflare R2) |
| **Email** | Resend |
| **Analytics** | PostHog |
| **Error Tracking** | Sentry |
| **AI** | OpenAI (estimators, intake), Anthropic (optional) |
| **Real-time** | Socket.io |
| **Background Jobs** | NestJS Scheduler (@nestjs/schedule) |

---

## Architecture Decisions

### Why This Tech Stack?

#### Frontend: React + Vite + TypeScript
- **React 18:** Industry standard, excellent ecosystem, proven for complex UIs
- **Vite:** Fast development server, instant hot reload, optimized production builds
- **TypeScript:** Type safety prevents runtime errors, better IDE support, self-documenting code
- **Tailwind CSS + shadcn/ui:** Consistent design system, accessible components, rapid development

#### Backend: NestJS + Prisma + PostgreSQL
- **NestJS:** Structured framework (like Express but opinionated), dependency injection, decorators for clean code
- **Prisma:** Type-safe database access, auto-generated client, migration system, excellent DX
- **PostgreSQL:** ACID compliance, JSON support, robust for SaaS workloads, scalable

#### Auth & Billing: Clerk + Stripe
- **Clerk:** Complete auth solution (login, signup, user management), multi-tenant ready, excellent DX
- **Stripe:** Battle-tested billing, webhooks, subscriptions, global compliance

#### Infrastructure Choices
- **Monorepo:** Shared code (packages/), easier refactoring, atomic changes across services
- **Docker:** Consistent environments, easy deployment, local development parity
- **Railway:** Simple deployment, managed infrastructure, great for SaaS MVPs

### Database Design Principles

#### Multi-Tenant Architecture
- **Workspace-based:** Each customer gets a workspace (soft isolation)
- **Shared Database:** Cost-effective, simpler queries, easier analytics
- **Row-Level Security:** Prisma middleware ensures users only see their workspace data

#### Key Entities Relationship
```
Workspace (1) ──── (N) User
    │
    ├── (N) Task
    ├── (N) Brand
    ├── (1) Subscription
    └── (N) Credit (daily burn)
```

#### Data Flow Patterns
- **CQRS-ish:** Read models optimized for UI, write models normalized for integrity
- **Event-Driven:** WebSocket updates for real-time features
- **Soft Deletes:** Preserve data integrity, enable audit trails

### API Design Philosophy

#### RESTful with GraphQL tendencies
- **Resource-based:** `/tasks`, `/brands`, `/workspaces`
- **Nested routes:** `/workspaces/:id/tasks` for scoping
- **HTTP status codes:** Proper semantics (201 for creation, 204 for deletion)
- **Pagination:** Cursor-based for performance
- **Filtering/Sorting:** Query parameters for flexibility

#### Authentication Strategy
- **JWT via Clerk:** Stateless, scalable, industry standard
- **Workspace Scoping:** All endpoints scoped to authenticated user's workspace
- **Role-Based Access:** Different permissions for client vs studio users

#### Error Handling
- **Structured Errors:** Consistent error response format across all endpoints
- **HTTP Status Mapping:** 400 for validation, 403 for permissions, 404 for not found
- **Logging:** Sentry integration for production error tracking

### Real-time Architecture

#### WebSocket Strategy
- **Socket.io:** Reliable connections, fallback to polling, room-based messaging
- **Task Updates:** Real-time status changes, new tasks, SLA warnings
- **Connection Management:** Automatic cleanup, reconnection handling

#### Event Types
- **Task Events:** Status changes, new comments, deadline updates
- **Notification Events:** Email sent, Slack messages, system alerts
- **Workspace Events:** Member changes, billing updates

### Security Considerations

#### Data Protection
- **Encryption:** TLS everywhere, encrypted database connections
- **Input Validation:** Zod schemas on all inputs, SQL injection prevention via Prisma
- **Rate Limiting:** API rate limits, DDoS protection via infrastructure

#### Authentication Security
- **Clerk Security:** SOC 2 compliant, secure token handling
- **Session Management:** Proper token expiration, refresh token rotation
- **Multi-factor:** Available via Clerk for high-security accounts

#### File Storage Security
- **S3/R2:** Server-side encryption, signed URLs for temporary access
- **Content Validation:** File type checking, size limits, malware scanning
- **Access Control:** Workspace-scoped file permissions

### Performance Optimizations

#### Database Performance
- **Indexing:** Strategic indexes on frequently queried columns
- **Connection Pooling:** Efficient database connection management
- **Query Optimization:** N+1 problem prevention, selective field loading

#### API Performance
- **Caching:** Redis for session data, CDN for static assets
- **Pagination:** Cursor-based pagination prevents deep pagination performance issues
- **Background Jobs:** Heavy operations moved to background (credit burning, notifications)

#### Frontend Performance
- **Code Splitting:** Route-based splitting via Vite
- **Lazy Loading:** Components loaded on demand
- **Image Optimization:** Responsive images, WebP format, lazy loading

### Scalability Considerations

#### Horizontal Scaling
- **Stateless API:** No server-side sessions, easy to scale horizontally
- **Database Sharding:** Workspace-based partitioning if needed
- **CDN:** Static assets served globally

#### Monitoring & Observability
- **Sentry:** Error tracking and performance monitoring
- **PostHog:** Product analytics and user behavior tracking
- **Health Checks:** Automated monitoring of all services

#### Cost Optimization
- **Railway:** Pay-for-what-you-use pricing
- **Database:** Connection pooling, query optimization
- **Storage:** Intelligent caching, compression

---

## Project Structure

```
sako-v1/
├── apps/
│   ├── client/                    # Client App (app.trysako.com)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── client/        # Dashboard, Tasks, Settings, etc.
│   │   │   │   ├── stripe/        # Embedded checkout
│   │   │   │   └── ui/            # shadcn/ui components
│   │   │   ├── pages/             # Route pages
│   │   │   └── lib/               # API client, analytics, auth
│   │   └── Dockerfile
│   │
│   └── studio/                    # Studio App (studio.trysako.com)
│       ├── src/
│       │   ├── components/
│       │   │   ├── Admin*.tsx     # Dashboard, Tasks, Kanban, etc.
│       │   │   └── ui/            # shadcn/ui components
│       │   ├── pages/             # Route pages
│       │   └── lib/               # API client, analytics, auth
│       └── Dockerfile
│
├── services/
│   └── api/                       # API (api.trysako.com)
│       ├── src/
│       │   ├── admin/             # Admin endpoints
│       │   ├── ai/                # AI intake & services
│       │   ├── auth/              # Clerk JWT auth
│       │   ├── billing/           # Plan config, validation
│       │   ├── brand/             # Brand profiles
│       │   ├── common/
│       │   │   ├── analytics/     # PostHog integration
│       │   │   ├── mail/          # Resend email service
│       │   │   ├── notifications/ # Multi-channel notifications
│       │   │   ├── storage/       # S3/R2 file storage
│       │   │   └── stripe/        # Stripe client config
│       │   ├── composer/          # Composer Gateway
│       │   ├── credits/           # Day credit burn & scheduling
│       │   ├── review/            # Review board API
│       │   ├── search/            # Global search
│       │   ├── slack/             # Slack integration
│       │   ├── stripe/            # Billing & webhooks
│       │   ├── studio/            # Studio-specific endpoints
│       │   ├── subscription/      # Pause/resume/cancel
│       │   ├── task/              # Task CRUD & workflow
│       │   ├── user/              # User management
│       │   └── workspace/         # Workspace management
│       ├── prisma/
│       │   ├── schema.prisma      # Database schema
│       │   └── seed.ts            # Seed data
│       ├── test/                  # Jest tests
│       └── Dockerfile
│
├── packages/
│   ├── review-ui/                 # Review Board component library
│   │   └── src/
│   │       ├── viewers/           # Asset type viewers
│   │       └── components/        # Annotation UI
│   ├── theme/                     # Shared CSS/theme
│   └── assets/                    # Shared assets (favicon)
│
├── scripts/
│   ├── create-stripe-plans.ts     # Bootstrap Stripe products
│   ├── delete-test-user.ts        # Cleanup test data
│   └── run-smoke-tests.sh         # Smoke test runner
│
├── docs/                          # Documentation
│   ├── PRODUCT_DOCUMENTATION.md   # Complete product docs
│   ├── QA_CHECKLIST.md            # Testing checklist
│   ├── STRIPE_ENV_VARS.md         # Stripe configuration
│   ├── PERFORMANCE.md             # Performance optimization guide
│   └── estimator-data-moat.md     # AI estimator strategy
│
├── docker-compose.yml             # Development containers
├── docker-compose.prod.yml        # Production containers
└── docker-start.sh                # Quick start script
```

---

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- PostgreSQL 15+ (or use managed DB like Neon/Supabase)
- Stripe account (test mode)
- Clerk account

### Docker (Recommended)

```bash
# Clone and enter directory
git clone <repo-url>
cd sako-v1

# Create .env from template
cp .env.example .env
# Edit .env with your credentials

# Start all services
./docker-start.sh

# Run database migrations
docker exec -it sako-api npx prisma migrate dev

# Seed initial data
docker exec -it sako-api npx prisma db seed
```

**Access:**
| Service | URL |
|---------|-----|
| Client App | http://localhost:5173 |
| Studio App | http://localhost:3000 |
| API Docs | http://localhost:3001/api/docs |

### Local Development (without Docker)

This setup gives you full control over each service and enables hot reloading for development.

#### 1. Database Setup
```bash
# Option A: Local PostgreSQL with Docker
docker run -d \
  --name sako-postgres \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=sako \
  postgres:15

# Option B: Managed Database (Recommended for team development)
# Use Neon (neon.tech) or Supabase (supabase.com)
# DATABASE_URL=postgresql://user:pass@host:5432/sako
```

#### 2. Environment Variables
```bash
# Copy and configure environment files
cp services/api/.env.example services/api/.env
cp apps/client/.env.example apps/client/.env
cp apps/studio/.env.example apps/studio/.env

# Edit each .env file with your credentials:
# - Database URL
# - Clerk keys (get from clerk.com)
# - Stripe keys (get from stripe.com in test mode)
# - Other service credentials as needed
```

#### 3. Install Dependencies
```bash
# Root level (installs workspace dependencies)
npm install

# Individual apps/services (optional - root install covers most)
cd apps/client && npm install
cd apps/studio && npm install
cd services/api && npm install
```

#### 4. Database Initialization
```bash
cd services/api

# Generate Prisma client
npx prisma generate

# Run migrations (creates tables, indexes, etc.)
npx prisma migrate dev

# Seed initial data (plans, test users, etc.)
npx prisma db seed

# Optional: Open Prisma Studio (database GUI)
npx prisma studio
```

#### 5. Start Development Servers
```bash
# Terminal 1: API Server (port 3001)
cd services/api && npm run dev

# Terminal 2: Client App (port 5173)
cd apps/client && npm run dev

# Terminal 3: Studio App (port 3000)
cd apps/studio && npm run dev
```

#### 6. Verify Setup
- **API Health:** http://localhost:3001/health
- **API Docs:** http://localhost:3001/api/docs
- **Client App:** http://localhost:5173
- **Studio App:** http://localhost:3000
- **Database:** http://localhost:5555 (if using Prisma Studio)

#### Development Tips
- **Hot Reloading:** All services support hot reload on file changes
- **Database Changes:** Run `npx prisma migrate dev` after schema changes
- **Environment Updates:** Restart services after .env changes
- **Logs:** Check terminal output for errors and warnings
- **Debugging:** Use browser dev tools for frontend, VS Code debugger for backend

---

## Development Workflows

### Git Flow & Branching

This project follows a simplified Git flow for B2B SaaS development:

```bash
# Feature development
git checkout -b feature/user-auth-improvements
# Make changes, test locally
git commit -m "feat: improve user authentication flow"
git push origin feature/user-auth-improvements

# Bug fixes
git checkout -b fix/stripe-webhook-timeout
git commit -m "fix: handle stripe webhook timeouts gracefully"
git push origin fix/stripe-webhook-timeout

# Releases (main branch is production-ready)
git checkout main
git pull origin main
git tag v1.2.3
git push origin v1.2.3
```

**Branch Naming:**
- `feature/description` - New features
- `fix/description` - Bug fixes
- `chore/description` - Maintenance/refactoring
- `hotfix/description` - Critical production fixes

### Testing Workflow

#### Unit Tests (Backend)
```bash
cd services/api

# Run all tests
npm test

# Run specific test file
npm test -- task-pipeline.spec.ts

# Run with coverage
npm run test:cov

# Debug specific test
npm test -- --testNamePattern="should handle task status transition"
```

#### E2E Tests (Frontend)
```bash
cd apps/client

# Run E2E tests (headless)
npm run test:e2e

# Run with browser UI for debugging
npm run test:e2e:ui

# Run specific test file
npm run test:e2e -- tests/auth.spec.ts
```

#### Load Testing
```bash
# Install k6 first: https://k6.io/docs/get-started/installation/

# Smoke test (basic functionality)
k6 run tests/load/k6-smoke.js

# Load test (normal usage patterns)
k6 run tests/load/k6-load.js

# Stress test (breaking point, staging only!)
k6 run tests/load/k6-stress.js
```

### Debugging & Development Tools

#### API Debugging
- **Swagger UI:** http://localhost:3001/api/docs
- **Prisma Studio:** `cd services/api && npx prisma studio`
- **Database Logs:** Check Docker container logs for SQL queries
- **API Logs:** Watch terminal output for request/response details

#### Frontend Debugging
- **React DevTools:** Inspect component trees and state
- **Network Tab:** Monitor API calls and responses
- **Console:** Check for client-side errors and warnings
- **Hot Reload:** Changes reflect immediately (Vite)

#### Common Debug Commands
```bash
# Check service health
curl http://localhost:3001/health

# Test API endpoint directly
curl -H "Authorization: Bearer YOUR_JWT" \
     http://localhost:3001/workspace/me

# Check database connection
cd services/api && npx prisma db push --preview-feature

# View migration status
cd services/api && npx prisma migrate status

# Reset database (development only)
cd services/api && npx prisma migrate reset
```

### Code Quality & Linting

```bash
# Run linting across all packages
npm run lint

# Fix auto-fixable issues
npm run lint:fix

# Type checking
npm run type-check

# Format code
npm run format
```

### Database Development

#### Schema Changes
```bash
cd services/api

# Modify schema.prisma
# Then generate migration
npx prisma migrate dev --name add_user_preferences

# Apply to production (after testing)
npx prisma migrate deploy
```

#### Data Seeding
```bash
# Re-seed development database
npx prisma db seed

# Custom seed file
npx ts-node prisma/seed.custom.ts
```

#### Backup/Restore
```bash
# Backup (development)
pg_dump sako > backup.sql

# Restore
psql sako < backup.sql
```

---

## Environment Variables

See `services/api/.env.example` for the complete list. Key variables:

### Required

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/sako

# Auth
CLERK_SECRET_KEY=sk_test_...
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Billing
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Stripe Product/Price IDs (see docs/STRIPE_ENV_VARS.md)
STRIPE_PRODUCT_ID_CORE=prod_...
STRIPE_PRICE_ID_CORE_MONTHLY=price_...
STRIPE_PRICE_ID_CORE_YEARLY=price_...
# ... (OPS, ENTERPRISE, COMPOSER_PRO)

# CORS
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

### Optional

```bash
# AI Features
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Storage (S3/R2)
STORAGE_ENDPOINT=https://...
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
STORAGE_BUCKET=sako-uploads

# Slack Integration
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
SLACK_BOT_TOKEN=xoxb-...

# Email
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@yourdomain.com

# Analytics & Monitoring
SENTRY_DSN=https://...
POSTHOG_API_KEY=ph_...
POSTHOG_HOST=https://us.i.posthog.com

# Composer Integration
COMPOSER_HMAC_SECRET=your_shared_hmac_secret
COMPOSER_URL=https://composer.trysako.com
```

---

## Scripts

```bash
# Root level
npm run dev:client          # Start client app
npm run dev:studio          # Start studio app
npm run dev:api             # Start API
npm run docker:up           # docker-compose up
npm run docker:up:build     # docker-compose up --build
npm run docker:down         # docker-compose down
npm run prisma:generate     # Generate Prisma client
npm run prisma:migrate      # Run migrations
npm run prisma:studio       # Open Prisma Studio

# In services/api
npm run dev                 # Start with hot reload
npm run build               # Build for production
npm run test                # Run tests
npm run prisma:studio       # Database GUI

# Bootstrap Stripe (run once)
npx ts-node scripts/create-stripe-plans.ts
```

---

## Testing

### Unit Tests

```bash
cd services/api

# Run all tests
npm test

# Run specific test files
npm test -- task-pipeline.spec.ts
npm test -- day-credit-burn.spec.ts
npm test -- stripe-subscription-sync.spec.ts
```

### E2E Tests (Playwright)

```bash
cd apps/client

# Run E2E tests
npm run test:e2e

# Run with UI
npm run test:e2e:ui
```

### Load Tests (k6)

```bash
# Install k6 first: https://k6.io/docs/get-started/installation/

# Smoke test
k6 run tests/load/k6-smoke.js

# Load test
k6 run tests/load/k6-load.js

# Stress test (staging only!)
k6 run tests/load/k6-stress.js
```

### Test Coverage

| Test File | Coverage |
|-----------|----------|
| `task-pipeline.spec.ts` | Task status transitions |
| `day-credit-burn.spec.ts` | Credit consumption logic |
| `task-slots.spec.ts` | Active task limits |
| `stripe-subscription-sync.spec.ts` | Webhook handling |
| `subscription.service.spec.ts` | Subscription pause/resume/cancel |
| `workspace.service.spec.ts` | Workspace limits & SLA |
| `brand.service.spec.ts` | Brand CRUD operations |
| `composer-capabilities.spec.ts` | Gateway permissions |
| `from-composer.spec.ts` | Send to Sako flow |
| `auth.guard.spec.ts` | Authentication |

---

## Troubleshooting

### Common Development Issues

#### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Check database logs
docker logs sako-postgres

# Test connection manually
psql postgresql://postgres:postgres@localhost:5432/sako -c "SELECT 1;"

# Reset database (development only)
cd services/api && npx prisma migrate reset
```

#### API Server Won't Start
**Error:** `Port 3001 already in use`
```bash
# Find process using port
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or find and kill Node processes
pkill -f "node.*services/api"
```

**Error:** `Prisma client not generated`
```bash
cd services/api
npx prisma generate
npm run dev
```

#### Frontend Build Issues
**Error:** `Module not found` or dependency issues
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# For individual apps
cd apps/client && rm -rf node_modules && npm install
```

**Error:** `TypeScript errors`
```bash
# Check types
npm run type-check

# Auto-fix some issues
npm run lint:fix
```

#### Environment Variable Issues
**Error:** `CLERK_SECRET_KEY is required`
```bash
# Check .env file exists and is properly formatted
cat services/api/.env | grep CLERK

# Ensure no extra spaces or quotes
# Correct: CLERK_SECRET_KEY=sk_test_...
# Wrong: CLERK_SECRET_KEY = "sk_test_..."
```

#### Authentication Issues
**Error:** `Invalid JWT` or `401 Unauthorized`
```bash
# Check Clerk keys match between frontend and backend
# Frontend: VITE_CLERK_PUBLISHABLE_KEY
# Backend: CLERK_SECRET_KEY

# Verify keys are for the same Clerk application
# Check Clerk dashboard: https://clerk.com
```

#### Stripe Webhook Issues
**Error:** `Webhook signature verification failed`
```bash
# Regenerate webhook endpoint secret in Stripe dashboard
# Update STRIPE_WEBHOOK_SECRET in .env
# Restart API server
```

#### CORS Issues
**Error:** `Access-Control-Allow-Origin` header missing
```bash
# Check CORS_ORIGINS in .env includes your frontend URLs
CORS_ORIGINS=http://localhost:5173,http://localhost:3000

# For production
CORS_ORIGINS=https://app.trysako.com,https://studio.trysako.com
```

### Testing Issues

#### E2E Tests Failing
```bash
# Ensure apps are running
curl http://localhost:5173
curl http://localhost:3000

# Check Playwright browser installation
cd apps/client && npx playwright install

# Run tests with debug output
npm run test:e2e -- --debug
```

#### API Tests Failing
**Error:** `Database connection timeout`
```bash
# Ensure test database is available
docker ps | grep postgres

# Check test database configuration in jest config
# services/api/jest.config.ts
```

### Deployment Issues

#### Railway Deployment Failing
```bash
# Check build logs in Railway dashboard
# Common issues:
# - Missing environment variables
# - Database connection timeouts
# - Prisma migration failures

# Check Railway environment variables match .env.example
# Ensure DATABASE_URL uses Railway's internal DNS
```

#### Docker Build Issues
```bash
# Build with verbose output
docker build --progress=plain -t sako-api .

# Check for missing files in .dockerignore
# Ensure all required environment variables are set
```

### Performance Issues

#### Slow API Responses
```bash
# Check database query performance
cd services/api && npx prisma studio

# Look for N+1 queries in logs
# Check for missing database indexes

# Profile with:
npm install -g clinic
clinic doctor -- node dist/main.js
```

#### Memory Leaks
```bash
# Monitor memory usage
docker stats

# Check for memory leaks in development
cd services/api && npm run dev:debug

# Use Chrome DevTools memory profiler
```

### Database Issues

#### Migration Failures
```bash
# Check migration status
npx prisma migrate status

# Resolve conflicts manually
npx prisma migrate resolve --applied <migration-id>

# Reset and reapply (development only)
npx prisma migrate reset
```

#### Data Corruption
```bash
# Backup current data
pg_dump sako > backup.sql

# Restore from backup
psql sako < backup.sql

# Check data integrity
npx prisma db execute --file scripts/check-integrity.sql
```

### Getting Help

1. **Check Logs:** Always check service logs first (`docker logs`, terminal output)
2. **Search Issues:** Look for similar issues in GitHub issues or documentation
3. **Environment Check:** Verify all required environment variables are set
4. **Restart Services:** Often fixes transient issues
5. **Clean Install:** Delete node_modules and reinstall as last resort

### Health Check Endpoints

```bash
# API Health
curl http://localhost:3001/health

# Database Health
curl http://localhost:3001/health/database

# Stripe Health
curl http://localhost:3001/health/stripe
```

---

## Security & Data Handling

### Authentication & Authorization

#### Clerk Integration
- **Shared Auth:** Same Clerk application across all apps (Client, Studio, API)
- **JWT Tokens:** Stateless authentication, validated on each request
- **Workspace Scoping:** All data access limited to authenticated user's workspace
- **Role-Based Access:** Different permissions for client users vs studio operators

#### API Security
```typescript
// All endpoints protected by Clerk JWT
@UseGuards(ClerkAuthGuard)
@Controller('tasks')
export class TaskController {
  // Automatic workspace scoping via middleware
}
```

#### Session Management
- **Token Expiration:** 1-hour JWT expiration with refresh tokens
- **Secure Cookies:** HttpOnly, Secure, SameSite protection
- **Logout:** Proper token invalidation across all sessions

### Data Protection

#### Database Security
- **Row-Level Security:** Prisma middleware ensures workspace isolation
- **Parameterized Queries:** SQL injection prevention via Prisma ORM
- **Connection Encryption:** TLS for all database connections
- **Backup Encryption:** Encrypted database backups

#### File Storage Security
- **S3/R2 Encryption:** Server-side encryption at rest
- **Signed URLs:** Temporary access tokens for file downloads
- **Content Validation:** File type, size, and malware scanning
- **Access Control:** Workspace-scoped file permissions

#### Data Encryption
- **Environment Variables:** Sensitive config encrypted
- **API Keys:** Rotated regularly, stored securely
- **PII Handling:** Minimal PII collection, GDPR compliance

### Privacy & Compliance

#### Data Collection
- **Minimal PII:** Only collect necessary user data
- **Workspace Data:** Customer data isolated by workspace
- **Audit Logging:** All data access and modifications logged
- **Data Retention:** Configurable retention policies

#### GDPR Compliance
- **Right to Deletion:** Complete data removal on request
- **Data Portability:** Export user data in standard formats
- **Consent Management:** Clear consent for data processing
- **Privacy by Design:** Privacy considerations in all features

### Infrastructure Security

#### Network Security
- **TLS Everywhere:** HTTPS enforced on all endpoints
- **CORS Policy:** Strict origin control for API access
- **Rate Limiting:** API rate limits prevent abuse
- **DDoS Protection:** CDN and infrastructure-level protection

#### Container Security
- **Minimal Images:** Distroless or Alpine-based containers
- **Non-root Users:** Services run as non-privileged users
- **Secret Management:** Environment variables, no secrets in code
- **Vulnerability Scanning:** Regular security scans

### Security Monitoring

#### Error Tracking
- **Sentry Integration:** Real-time error monitoring
- **Alert Configuration:** Critical error notifications
- **Performance Monitoring:** Slow query and endpoint alerts
- **Security Events:** Authentication failure tracking

#### Access Monitoring
- **Audit Logs:** All API access logged with user context
- **Failed Login Tracking:** Brute force protection
- **Suspicious Activity:** Automated threat detection
- **Compliance Reporting:** Security event reporting

### Secure Development Practices

#### Code Security
- **Input Validation:** Zod schemas for all API inputs
- **Type Safety:** TypeScript prevents type-related vulnerabilities
- **Dependency Scanning:** Regular vulnerability checks
- **Code Reviews:** Security-focused code review process

#### Secret Management
```bash
# Never commit secrets to git
.env
.env.local
.env.*.local

# Use environment variables for all secrets
STRIPE_SECRET_KEY=sk_live_...
CLERK_SECRET_KEY=sk_live_...
```

#### API Security Headers
```
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000
```

### Incident Response

#### Security Incident Process
1. **Detection:** Automated monitoring alerts
2. **Assessment:** Determine scope and impact
3. **Containment:** Isolate affected systems
4. **Recovery:** Restore from clean backups
5. **Lessons Learned:** Post-mortem and improvements

#### Data Breach Response
- **Immediate Notification:** Affected customers within 72 hours
- **Regulatory Reporting:** Required legal notifications
- **Credit Monitoring:** Free credit monitoring for affected users
- **Remediation:** Security improvements and patches

### Third-Party Security

#### Vendor Risk Management
- **Clerk:** SOC 2 Type II compliant
- **Stripe:** PCI DSS Level 1 compliant
- **Railway:** SOC 2 compliant infrastructure
- **Sentry:** SOC 2 compliant monitoring

#### Integration Security
- **HMAC Validation:** Composer integration uses HMAC-signed requests
- **Webhook Verification:** Stripe webhooks verified with signatures
- **API Key Rotation:** Regular rotation of third-party API keys

### Security Checklist

#### Pre-Production
- [ ] Environment variables configured securely
- [ ] Database backups tested and encrypted
- [ ] SSL certificates configured
- [ ] Security headers implemented
- [ ] Rate limiting configured
- [ ] Monitoring and alerting active

#### Ongoing
- [ ] Regular security scans
- [ ] Dependency updates
- [ ] Security training for team
- [ ] Incident response drills
- [ ] Compliance audits

---

## API Documentation

When the API is running, access Swagger docs at:
- **Development:** http://localhost:3001/api/docs
- **Production:** https://api.trysako.com/api/docs

Key endpoints:

| Endpoint | Description |
|----------|-------------|
| `GET /workspace/me` | Current workspace details |
| `GET /tasks` | List tasks for workspace |
| `POST /tasks` | Create new task |
| `PATCH /tasks/:id/status` | Update task status |
| `GET /search` | Global search |
| `POST /stripe/create-checkout-session` | Start subscription |
| `POST /subscription/pause` | Pause subscription |
| `GET /composer/sso-token` | Get SSO token for Composer redirect |
| `GET /composer/capabilities` | Composer plan info & features |
| `GET /composer/brands` | Brands for Composer (Clerk auth) |
| `GET /composer/internal/brands/:id` | Brands for Composer (HMAC auth) |
| `POST /composer/tasks/from-draft` | "Send to Sako" from Composer |

---

## Deployment

### Deployment Options

#### Railway (Recommended for SaaS)

Railway provides managed infrastructure perfect for SaaS applications.

**1. Create Railway Project**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and create project
railway login
railway init sako-v1
```

**2. Database Setup**
```bash
# Add PostgreSQL database
railway add postgresql

# Get database URL from Railway dashboard
# Add to environment variables as DATABASE_URL
```

**3. Deploy Services**
```bash
# Deploy API
railway up --service api

# Deploy Client App
railway up --service client

# Deploy Studio App
railway up --service studio
```

**4. Environment Variables**
Set these in Railway dashboard (Variables tab):

```bash
# Database
DATABASE_URL=${{Postgres.DATABASE_URL}}

# Auth (Clerk)
CLERK_SECRET_KEY=sk_live_...
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...

# Billing (Stripe)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_PRODUCT_ID_CORE=prod_...
STRIPE_PRICE_ID_CORE_MONTHLY=price_...
# ... other Stripe IDs

# Storage (Cloudflare R2)
STORAGE_ENDPOINT=https://...
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
STORAGE_BUCKET=sako-uploads

# Monitoring
SENTRY_DSN=https://...
POSTHOG_API_KEY=phc_...

# Email (optional)
RESEND_API_KEY=re_...

# CORS
CORS_ORIGINS=https://app.trysako.com,https://studio.trysako.com,https://api.trysako.com

# Composer Integration
COMPOSER_HMAC_SECRET=your_shared_secret
COMPOSER_URL=https://composer.trysako.com
```

**5. Domain Configuration**
```bash
# Set custom domains in Railway dashboard
# app.trysako.com → client service
# studio.trysako.com → studio service
# api.trysako.com → api service
```

**6. Database Migration**
```bash
# Run migrations after deployment
railway run --service api npx prisma migrate deploy

# Seed initial data
railway run --service api npx prisma db seed
```

#### VPS Deployment (DigitalOcean, Linode, etc.)

For full control and cost optimization.

**1. Server Setup**
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker & Docker Compose
sudo apt install docker.io docker-compose -y
sudo systemctl enable docker

# Install Caddy (reverse proxy)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install caddy
```

**2. Database Setup**
```bash
# Use managed PostgreSQL (Neon, Supabase) for simplicity
# Or install PostgreSQL locally
sudo apt install postgresql postgresql-contrib -y
sudo -u postgres createdb sako
```

**3. Clone and Configure**
```bash
# Clone repository
git clone <your-repo-url> sako-v1
cd sako-v1

# Configure environment
cp .env.example .env
# Edit .env with production values
```

**4. SSL Certificates (Let's Encrypt)**
```bash
# Configure Caddy for automatic SSL
sudo nano /etc/caddy/Caddyfile

# Example Caddyfile:
app.trysako.com {
    reverse_proxy localhost:5173
}

studio.trysako.com {
    reverse_proxy localhost:3000
}

api.trysako.com {
    reverse_proxy localhost:3001
}
```

**5. Deploy with Docker Compose**
```bash
# Build and deploy
docker-compose -f docker-compose.prod.yml up -d --build

# Run migrations
docker exec sako-api npx prisma migrate deploy
docker exec sako-api npx prisma db seed
```

**6. Monitoring Setup**
```bash
# Install monitoring tools
sudo apt install htop iotop -y

# Setup log rotation
sudo nano /etc/logrotate.d/sako
```

#### Docker Production

```bash
# Quick deployment with existing docker-compose.prod.yml
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Update deployment
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### Production Checklist

**Infrastructure:**
- [ ] Managed PostgreSQL with backups (Neon, Supabase, RDS)
- [ ] S3/R2 bucket with CORS configured
- [ ] DNS configured for all subdomains
- [ ] SSL certificates configured (Caddy auto-manages)

**Services:**
- [ ] Stripe live mode + webhook endpoints configured
- [ ] Clerk production instance created
- [ ] Sentry project for error tracking
- [ ] PostHog project for analytics
- [ ] Resend for transactional email (optional)
- [ ] Slack app for integration (optional)

**Deployment:**
- [ ] All environment variables set (see [docs/SECRETS.md](./docs/SECRETS.md))
- [ ] `prisma migrate deploy` executed
- [ ] Database seeded with plans and initial data
- [ ] Health check endpoints responding (`/health`)
- [ ] Stripe webhook test events succeeding
- [ ] CORS configured for production domains

**Monitoring:**
- [ ] Sentry alerts configured for critical errors
- [ ] Uptime monitoring active (UptimeRobot, Pingdom)
- [ ] Database monitoring configured
- [ ] Log aggregation setup
- [ ] Performance monitoring active

**Security:**
- [ ] SSL/TLS configured for all domains
- [ ] Security headers implemented
- [ ] Rate limiting configured
- [ ] Backup strategy tested
- [ ] Access controls verified

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for the complete deployment guide.

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/PRODUCT_DOCUMENTATION.md](./docs/PRODUCT_DOCUMENTATION.md) | Complete product documentation |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Production deployment guide (VPS/Docker) |
| [docs/RAILWAY_DEPLOYMENT.md](./docs/RAILWAY_DEPLOYMENT.md) | Railway deployment guide (recommended) |
| [docs/DATABASE_OPS.md](./docs/DATABASE_OPS.md) | Database operations & migrations |
| [docs/MONITORING.md](./docs/MONITORING.md) | Monitoring & observability setup |
| [docs/RUNBOOK.md](./docs/RUNBOOK.md) | Operations runbook for incidents |
| [docs/SECRETS.md](./docs/SECRETS.md) | Environment variables & secrets |
| [docs/QA_CHECKLIST.md](./docs/QA_CHECKLIST.md) | Manual & automated testing guide |
| [docs/STRIPE_ENV_VARS.md](./docs/STRIPE_ENV_VARS.md) | Stripe configuration reference |
| [docs/PERFORMANCE.md](./docs/PERFORMANCE.md) | Performance optimization guide |
| [docs/estimator-data-moat.md](./docs/estimator-data-moat.md) | AI estimator data strategy |

---

## Contributing

1. Follow existing patterns in the codebase
2. Use TypeScript strictly (no `any` where avoidable)
3. Write tests for new features
4. Keep PRs focused and small
5. Update documentation when adding features

---

## License

Proprietary — Creative Ops, Inc.

---

<div align="center">
<strong>Built by Koushik Venkatesan, Creative Ops, Inc.</strong>
</div>
