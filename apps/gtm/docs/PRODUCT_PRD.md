# Sako Composer Product Requirements Document

## Document Purpose

This PRD translates the current repository into a product definition. It is based on the app structure, route surface, data model, and platform subsystems present in the codebase as of March 2026.

This is not a future-state fantasy doc. It is meant to answer a practical question:

"What product are we actually building here?"

## Product Name

Sako Composer

Tagline:
AI GTM Factory for compliance-first marketing teams

## Product Summary

Sako Composer is a workspace for marketing teams to:

1. Import a company's brand, positioning, claims, and evidence from websites and connected sources
2. Build a reusable internal source of truth called the GTM Brain
3. Generate multi-channel campaign assets from that source of truth
4. Validate marketing claims against evidence and policy before publish or export
5. Route work through approvals, automation, deployment, and human escalation when needed

The product is positioned between:

- generic AI chat tools
- marketing automation suites
- design tools
- compliance review workflows

The core thesis is:

AI-generated GTM content becomes useful to teams only when it is grounded in approved brand context, constrained by compliance policy, and connected to execution systems.

## Problem Statement

Modern marketing teams have four structural problems:

1. Generic AI tools generate content quickly, but they do not understand what a company is actually allowed to say.
2. Brand knowledge is fragmented across websites, docs, decks, Notion, Figma, GitHub, and ad platforms.
3. Compliance review happens after content is created, which slows teams down and creates rework.
4. Execution is fragmented across channels, so content generation does not naturally connect to deployment, measurement, or revision loops.

For regulated teams, enterprise teams, agencies, and B2B growth teams, this means AI creates volume but not trust.

## Product Vision

Sako Composer should become the operating system for AI-assisted go-to-market work.

The system should let a team say:

"Use AI to generate the campaign, but only from approved facts, with evidence-backed claims, with clear approval and deploy boundaries."

Long term, the product should behave less like a prompt box and more like a governed GTM production system.

## Target Users

### Primary Users

- Marketing managers running campaigns
- Growth teams launching pages, ads, email, and social assets
- Content operators who manage high-volume asset creation
- Agencies producing work for multiple client brands

### Secondary Users

- Brand and creative reviewers
- Compliance and legal reviewers
- RevOps and marketing ops teams
- Founders and GTM leads in smaller organizations

### High-Value Customer Segments

- B2B SaaS teams with multiple campaign surfaces
- Compliance-heavy industries such as fintech, healthcare, legal, insurance
- Agencies that need repeatable brand-safe output
- Mid-market and enterprise teams that want AI usage with governance

## Jobs To Be Done

### Functional Jobs

- Import my brand and product context without manually briefing the model every time
- Generate a multi-asset campaign from one brief
- See which claims are risky before anything goes live
- Attach or discover evidence for claims
- Route work to review, approval, or human design help
- Export or deploy into the tools my team already uses

### Emotional Jobs

- Feel safe using AI in front of legal, compliance, or leadership
- Reduce the fear that the model invented something false
- Avoid rewriting the same brand context in every workflow

### Social Jobs

- Show that the marketing team can move faster without becoming sloppy
- Demonstrate operational maturity around AI-assisted content

## Product Principles

1. Compliance is upstream, not an afterthought.
2. Brand truth should be reusable across every generation surface.
3. Capability claims in the UI must be honest.
4. Human review is part of the system, not evidence of failure.
5. The product should support both chat-first and structured workflows.

## Core Product Pillars

### 1. GTM Brain

The GTM Brain is the source-of-truth layer for brand and product context.

It aggregates:

- source records
- product facts
- legal or policy rules
- approved snapshots
- provenance for generated assets

Why it matters:
This is the platform's strongest candidate moat. It turns AI output from stateless generation into governed generation.

### 2. ClaimsOS

ClaimsOS is the compliance engine for marketing claims.

It covers:

- claim extraction
- policy-based validation
- evidence linking
- risk scoring
- rewrite suggestions
- audit trail
- hard publish or deploy gates

Why it matters:
This is the clearest strategic wedge versus generic AI tools.

### 3. Multi-Asset Campaign Generation

The platform generates campaign assets from shared context across:

- landing pages
- social posts
- email sequences
- sales decks
- video scripts
- ads

Why it matters:
The app is not a single-asset tool. It is trying to own campaign production, not isolated generation moments.

### 4. Workflow and Review Layer

The product includes:

- requests
- approvals
- automation queue
- team surfaces
- collaboration
- human escalation to Sako

Why it matters:
This is how the app becomes operational software instead of a creative sandbox.

### 5. Delivery and Integrations

The platform supports:

- direct deploy for some providers
- export-only paths for others
- publishing
- packaging
- provider health and connection management

Why it matters:
The product value increases when generation is connected to real systems of record.

## User Value Proposition

### Core Value

Generate campaigns faster without losing control of brand truth or compliance safety.

### Differentiated Value

Sako Composer does not just generate content.
It creates governed GTM output with evidence, rules, approvals, and deploy boundaries.

### Why Customers Would Buy

- Fewer compliance issues
- Faster campaign creation
- Less context re-entry across teams and channels
- Better consistency across assets
- Better auditability for AI-assisted work

## Product Scope

## In Scope

- URL and source import
- Brand extraction
- GTM Brain management
- Campaign creation
- Launch kit generation
- Multi-asset content generation
- Claims and evidence workflows
- Compliance validation and gating
- Visual editing and export
- Approval workflows
- Provider integrations and deployment
- Human escalation
- Automation with approval-first defaults

## Out of Scope

- Becoming a full CRM
- Becoming a full MAP replacement for every customer
- Becoming a general-purpose design suite for non-GTM work
- Fully autonomous publishing without policy boundaries

## Primary Use Cases

### Use Case 1: Zero-Input Brand Bootstrap

A user pastes a URL.
The app extracts:

- brand identity
- design tokens
- claims
- evidence candidates
- compliance summary

The user now has enough context to generate assets without starting from scratch.

### Use Case 2: Governed Campaign Creation

A marketer creates a campaign or launch kit, selects asset types, and generates outputs from approved GTM Brain context.

The system persists:

- campaign structure
- generated asset documents
- claim metadata
- compliance summary

### Use Case 3: Compliance Review Before Publish

Claims are reviewed, linked to evidence, rewritten, or overridden with audit trail.
High-risk unresolved claims block export or deploy.

### Use Case 4: Multi-Channel Delivery

The user exports or deploys campaign assets to connected platforms, with explicit provider capability labels and fallback to export when needed.

### Use Case 5: Human Escalation

If AI output is not good enough, the user sends work to Sako for design refinement, copywriting, or brand refresh.

## Current Product Shape

The app currently presents as a broad platform with these visible areas:

- chat-first agent experience
- campaigns and launch kits
- import and brand intelligence
- claims, evidence, and validator flows
- automation and queue management
- requests and reviews
- IQ, memory, and knowledge surfaces
- integrations and settings
- collaboration and canvas/editor surfaces

This means the current product is best understood as a platform, not a single workflow tool.

## Recommended Product Positioning

The sharpest positioning for this product is:

Sako Composer is a compliance-first AI GTM workspace for teams that need campaign generation tied to approved brand facts, evidence-backed claims, and deploy-ready workflows.

Avoid leading with:

- "AI marketing generator"
- "Canva for AI marketing"
- "all-in-one marketing platform"

Those categories are crowded and undersell the strongest wedge.

Lead with:

- AI governance for GTM
- evidence-backed campaign generation
- brand-safe and compliance-safe publishing

## Personas

### Persona 1: Growth Marketing Lead

Goals:

- launch campaigns quickly
- create multiple asset types from one brief
- avoid bottlenecks from legal review

Pain points:

- repeated briefing
- inconsistent copy across channels
- compliance review arriving too late

### Persona 2: Marketing Ops / RevOps

Goals:

- operationalize campaign production
- connect generation to systems
- track usage, status, and outputs

Pain points:

- manual handoffs
- disconnected tools
- no audit trail on AI content

### Persona 3: Compliance / Brand Reviewer

Goals:

- review risky claims efficiently
- enforce approved language and evidence requirements

Pain points:

- AI hallucinations
- unverifiable superlatives
- lack of provenance

### Persona 4: Agency Operator

Goals:

- run repeatable workflows across client brands
- keep outputs brand-safe
- manage review and production throughput

Pain points:

- client context fragmentation
- revision loops
- inconsistent asset quality

## Success Metrics

### Product Metrics

- time from import to first campaign draft
- time from brief to multi-asset campaign output
- claim validation completion rate
- percent of blocked claims resolved before publish
- percent of assets generated from approved Brain snapshots
- export and deploy success rate
- human escalation rate

### Business Metrics

- paid workspace conversion
- expansion from single-user to team plans
- attach rate of higher-tier features such as escalation and enterprise governance
- retention of active workspaces generating campaigns monthly

### Quality Metrics

- false-positive and false-negative rate for compliance checks
- approval cycle time
- edit distance from generated output to final approved output
- repeated use of imported Brain context across campaigns

## Monetization Model

Observed monetization shape:

- Solo
- Team
- Growth
- Enterprise

Likely monetization logic:

- seat and workspace expansion
- usage-limited generations and publishes
- premium governance
- SSO and enterprise controls
- premium human services via Sako escalation

This is a credible 2026 B2B SaaS plus services hybrid.

## Product Risks

### 1. Feature Sprawl

The app contains many surfaces. Without a clear story, it can feel like multiple half-products.

### 2. Incomplete Wiring Between Strategy and Enforcement

Some workflows describe stronger compliance behavior than the implementation currently guarantees in every path.

### 3. Trust Risk

If compliance claims are stronger than actual enforcement, the product positioning becomes fragile.

### 4. Onboarding Complexity

The platform is powerful, but a new user could struggle to understand whether to start in import, campaigns, launch kits, agent, or requests.

## Product Recommendations

### Near-Term

1. Treat GTM Brain + ClaimsOS as the product core.
2. Make import -> Brain approval -> campaign generation the default path.
3. Make compliance state visible on every asset and deploy surface.
4. Clarify which features are production-grade versus exploratory.

### Positioning

1. Sell the product as governed AI GTM operations.
2. Make "evidence-backed claims" a primary message.
3. Treat human escalation as premium assist, not the main product.

### Packaging

1. Core platform: import, Brain, generation, claims, approvals, export
2. Growth layer: automation, experiments, performance
3. Enterprise layer: SSO, regional policy, audit, advanced approvals
4. Premium services: Sako escalation

## Product Definition In One Paragraph

Sako Composer is a compliance-first AI GTM platform that helps teams import brand truth, generate multi-channel campaigns from approved context, validate claims against evidence and policy, route work through review and approvals, and export or deploy safely into downstream systems. Its strategic moat is not generation alone, but governed generation tied to reusable brand intelligence and hard operational controls.
