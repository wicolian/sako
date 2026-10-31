# CLAUDE.md                                            

  This file provides guidance to Claude Code (claude.ai/code) when working with code in this
  repository.

  ## Commands

  ```bash
  pnpm dev          # Start dev server (Turbopack disabled: TURBOPACK=0)
  pnpm build        # Production build
  pnpm start        # Serve production build
  pnpm lint         # Run ESLint
  pnpm analyze      # Bundle analysis (sets ANALYZE=true)

  No test suite is configured.

  Architecture Overview

  Sako is a Next.js 15 (App Router) marketing site for a Design Ops service. It uses two
  separate content systems:

  Content Systems

  1. MDX Pages (/content/**/*.mdx) — all marketing/landing pages
    - Rendered by src/app/[...slug]/page.tsx (catch-all route)
    - Each file has YAML frontmatter: title, slug, seo, jsonLd, published, priority
    - MDX imports React components directly from @/components/blocks/
  2. Blog Posts (Sanity CMS, projectId 6kk8tx3u, dataset production)
    - Fetched at build time via src/sanity/client.ts
    - Routes: src/app/blog/page.tsx and src/app/blog/[slug]/page.tsx
    - Content rendered via Portable Text in src/components/blog/BlogContent.tsx
    - Sanity Studio config lives in /sako/

  Centralized Marketing Config

  src/config/landing.ts is the single source of truth for all marketing copy. Pricing tiers,
  nav links, CTAs, FAQs, feature lists, and comparison data are configured here and consumed
  by components.

  Component Hierarchy

  src/components/
  ├── blocks/        # MDX-embeddable (Hero, FeatureGrid, FAQAccordion, etc.)
  ├── landing/       # Full-page landing sections (HowItWorks, SakoOS, Pricing, etc.)
  ├── blog/          # Blog-specific (TableOfContents, SidebarStack, AuthorCard, etc.)
  └── ui/            # Base primitives (animations, buttons, cards, form, layout, visuals)

  Key Utilities

  - cn() in src/lib/utils.ts — always use for conditional Tailwind classes
  - src/lib/motion-variants.ts — shared Framer Motion presets; reuse before creating new ones
  - src/lib/blog-helpers.ts — extractHeadings(), readTime(), formatDate(), generateSlug()
  - src/config/external-links.ts — all external URLs; never hardcode URLs in components

  Forms & Integrations

  - Newsletter → NewsletterForm.tsx → POST /api/newsletter → Brevo
  - Demo request → DemoRequestForm.tsx → POST /api/demo
  - Booking → Cal.com iframe (url from external-links.ts)

  Styling Conventions

  - Primary accent: #9AE83E (bright green)
  - Fonts: Geist Sans (default), Geist Mono, Playfair Display (serif headlines)
  - Tailwind CSS v4 — configured in globals.css, not tailwind.config.js
  - Use CVA (class-variance-authority) for component variants

  Analytics

  All trackers initialized in src/app/layout.tsx: PostHog, GTM, Leadfeeder, Apollo, REB2B,
  Clarity. UTM params persisted via src/lib/utm-store.ts.

  Key Environment Variables

  NEXT_PUBLIC_POSTHOG_KEY
  NEXT_PUBLIC_POSTHOG_HOST
  NEXT_PUBLIC_GTM_ID
  SANITY_PROJECT_ID=6kk8tx3u
  SANITY_DATASET=production
  SANITY_API_VERSION=2024-01-01

  To allow me to write it directly, you can enable Write permissions for this session. The key
   points captured:
  - **Commands** (dev/build/lint, no tests)
  - **Dual content system** (MDX pages vs Sanity blog)
  - **`src/config/landing.ts`** as the marketing copy source of truth
  - **Component hierarchy** (blocks/landing/blog/ui)
  - **Styling** (Tailwind v4 in globals.css, CVA, green accent)
  - **External links config** to avoid hardcoded URLs