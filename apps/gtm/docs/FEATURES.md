# Sako Composer Features Inventory

## Purpose

This file lists the platform features visible in the repository and groups them by product importance.

The goal is clarity, not perfect taxonomy.

Definitions:

- Major feature: a product pillar or high-value workflow the platform can be sold around
- Minor feature: a supporting capability, helper workflow, or adjacent enhancement

## Major Features

### 1. URL Import and Brand Extraction

Major because it solves blank-state onboarding and creates reusable context.

Includes:

- URL fetch and parsing
- ownership confirmation
- design token extraction
- brand voice and audience analysis
- logo and visual context extraction
- claim extraction from imported pages
- evidence research and linking
- compliance summary generation

### 2. GTM Brain

Major because it acts as the source-of-truth layer behind generation.

Includes:

- source management
- sync runs
- product facts
- legal rules
- approved Brain snapshots
- provenance binding between snapshots and generated assets

### 3. ClaimsOS / Compliance Engine

Major because it is one of the platform's clearest strategic differentiators.

Includes:

- claim detection
- policy-based validation
- rules engine
- evidence linking
- risk scoring
- claim rewrite suggestions
- compliance audit trail
- claim override recording
- compliance status reporting
- hard compliance gates on export and deploy

### 4. Multi-Asset Campaign Generation

Major because the product is not limited to one content type.

Includes:

- campaign creation
- campaign message generation
- landing page generation
- social post generation
- email sequence generation
- deck generation
- video script generation
- structured generation progress streams
- asset document persistence

### 5. Launch Kits

Major because it is an opinionated packaging layer for go-to-market launches.

Includes:

- brief wizard
- brand selection
- guided generation flow
- review state
- export state
- integration with validated copy from gate flow

### 6. Agent-First Workspace Assistant

Major because the root product experience is chat-first by default.

Includes:

- workspace chat sessions
- model preference selection
- tool-based workspace operations
- campaign lookup
- claims lookup
- evidence lookup
- campaign creation from conversation
- claim validation from conversation
- template lookup from conversation

### 7. Visual Editing and Asset Editing

Major because generated output needs human refinement.

Includes:

- visual editor shell
- preview, design, and code modes
- layers panel
- properties panel
- background editing
- theme preview
- transition picker
- navigation builder
- breakpoint toolbar
- asset-type-specific editors

### 8. Export, Publish, and Deployment

Major because the product aims to connect generation to execution.

Includes:

- HTML export
- ZIP or package export
- PDF render paths
- image render paths
- direct provider deploy for supported targets
- export-only fallback for unsupported targets
- deployment idempotency
- connection checks
- publish to subdomain flow

### 9. Integrations and Provider Layer

Major because the platform value increases when connected to downstream systems.

Includes:

- provider registry
- provider capability labels
- connected provider status
- OAuth connection flows
- CMS and website providers
- marketing automation providers
- ad providers
- analytics providers
- Slack and Notion integrations

### 10. Requests and Workflow Management

Major because this turns the app into an operating workflow system instead of a generator.

Includes:

- request creation
- request queue
- request status workflow
- request filtering and search
- request feedback threads
- request stats

### 11. Approvals and Governance

Major because governed review is core to enterprise usage.

Includes:

- approval templates
- multi-stage approval instances
- reviewer decisions
- request changes and rejection paths
- campaign approval status updates

### 12. Automation

Major because it extends the platform from one-time generation into recurring content operations.

Includes:

- automation rules
- automation presets
- schedules
- approval-required generation
- automation queue
- scheduled content approval and rejection

### 13. Human Escalation to Sako

Major because it creates a high-value fallback path and services layer.

Includes:

- Send to Sako workflow
- task creation with idempotency
- task status lifecycle
- external sync support
- snapshots for handoff
- task polling and webhook updates
- delivery and feedback loop support

### 14. Workspace Collaboration

Major because the app is clearly designed for teams, not just solo users.

Includes:

- workspace membership
- sharing
- permissions management
- comments
- mentions
- private chat
- live cursors
- canvas collaboration
- activity and team views

### 15. Billing, Plans, and Enterprise Controls

Major because the repo contains explicit packaging and monetization structure.

Includes:

- pricing tiers
- usage metering
- billing routes
- subscription management
- AI wallet
- SSO and SAML support
- enterprise budget enforcement

## Minor Features

### Brand and Intelligence Surfaces

- brand DNA dashboard
- color palette views
- tone analyzer
- audience insights
- IQ dashboard
- memory views
- knowledge management surfaces

### Campaign Optimization and Analytics

- performance prediction
- campaign health scoring
- provider health dashboards
- observability dashboards
- analytics routes
- prediction cards
- campaign refresh flows

### Experimentation

- A/B test management
- variant assignment
- winner detection
- experiment tracking

### Template System

- template marketplace
- template ingestion
- template sanitization
- brand assembler
- design system compiler
- remix tracking
- paid template support

### Design and Creative Tools

- playground canvas
- block editor
- block palette
- component browser
- typography and spacing panels
- social visual templates
- image remix
- reference picker

### Figma and Design Interop

- Figma import
- Figma export
- Figma sync routes
- layout templates

### Video and Media

- voiceover generation
- video assembly
- render service
- Remotion Lambda hooks
- image generation
- UGC generator
- influencer content generation

### Publishing and Website Utilities

- font manager
- responsive utilities
- theme manager
- transitions
- snippet support
- page manager

### Communication and Notifications

- Slack commands
- Slack AI route
- webhook integrations for Make and Pabbly
- team run and continue flows

### Marketplace and Growth Add-Ons

- affiliate program
- referral stats
- referral links
- payout history
- marketplace purchase flows
- remix attribution

### Admin and Internal Tools

- admin page
- audit routes
- traces
- MCP server
- provider health internals

## Features That Look Core But Are Still Maturing

These matter strategically, but parts of them still look early or uneven in implementation.

### Learning Loop

- edit and export telemetry exist conceptually
- some feedback and event capture exists
- full closed-loop optimization is not yet the clearest product surface

### Performance Prediction

- present and useful as an assistive feature
- still appears closer to advisory intelligence than a deeply validated forecasting system

### IQ and Memory

- strategically important as a knowledge layer
- some surfaces look more foundational than fully mature

### Broad Direct Deploy Coverage

- provider architecture is strong
- actual provider depth likely varies significantly by destination

## Product Core vs Supporting Surface

If the company had to explain itself in the fewest possible product modules, the core would be:

1. Import and GTM Brain
2. Campaign and launch-kit generation
3. ClaimsOS and compliance gates
4. Editing, approval, and workflow
5. Export, deploy, and escalation

Everything else is either amplification, packaging, or future moat.

## Simplified Feature Hierarchy

### Core

- URL import
- GTM Brain
- ClaimsOS
- campaign generation
- launch kits
- editing
- approvals
- export and deploy
- Sako escalation

### Growth Layer

- automation
- experiments
- analytics
- performance prediction
- provider ecosystem

### Enterprise Layer

- SSO
- audit trails
- policy templates
- advanced approvals
- team governance
- workspace-level controls

### Nice-to-Have or Peripheral

- affiliate
- marketplace
- some playground and exploratory design surfaces
- some memory and IQ presentation layers

## One-Line Features Summary

Sako Composer's major features center on governed AI campaign production, while its minor features extend that core with intelligence, optimization, collaboration, integrations, and commercial add-ons.
