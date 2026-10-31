# Sako Composer User Flows

## Purpose

This document explains how a user is expected to move through Sako Composer as a product, not as a codebase.

It covers the main journeys a product manager, founder, or operator should understand first.

## Product Entry Model

There are three practical entry points into the app:

1. Agent-first entry
2. URL import entry
3. Structured campaign or launch-kit entry

These are not separate products. They are different starting points into the same operating system.

## North Star Flow

The cleanest end-to-end flow is:

1. User imports a website or source
2. System extracts brand, claims, evidence, and design context
3. User reviews or approves GTM Brain context
4. User creates a campaign or launch kit
5. System generates multi-asset output
6. User reviews claims and evidence
7. User edits assets if needed
8. User routes work to approval, export, deploy where available, or human escalation
9. System tracks status and usage across the workspace

This is the product's ideal story.

## Flow 1: New Workspace Onboarding

### Goal

Get a new user from blank workspace to usable brand and campaign context.

### Trigger

- first login
- first workspace creation
- user has no brand or source context yet

### Steps

1. User signs up or logs in
2. User lands in onboarding or main workspace
3. User is prompted to add a brand or import a website
4. User confirms content ownership for import
5. System analyzes the URL
6. System stores extracted brand data, claims, evidence, and summary state
7. User continues into dashboard, compliance, or campaign creation

### User Outcome

The workspace is no longer blank. The user has an initial brand profile and compliance baseline.

### Product Intent

Reduce setup friction and eliminate the need to hand-write long prompts.

## Flow 2: URL Import -> Brand Bootstrap

### Goal

Turn an existing website into reusable GTM context.

### Entry Point

`/import`

### Steps

1. User pastes a URL
2. User confirms they own the content
3. System fetches the page
4. System parses structure and text
5. System extracts design tokens
6. System analyzes brand voice, audience, and positioning
7. System detects marketing claims
8. System researches evidence for those claims when available
9. System links evidence to claims and generates a compliance summary
10. System stores results in the workspace

### User Decisions

- continue to dashboard
- review claims in compliance
- use extracted brand context for future generation

### Product Outcome

The system builds a first-pass brand memory layer without heavy manual input.

## Flow 3: GTM Brain Setup and Approval

### Goal

Create an approved source of truth that generation can rely on.

### Trigger

- brand import complete
- user connects sources such as URL, GitHub, Notion, Webflow, Framer, or manual content

### Steps

1. User adds one or more sources
2. System syncs and extracts product facts, legal rules, and related context
3. System creates or updates Brain snapshots
4. User or reviewer examines source quality, conflicts, and status
5. A Brain snapshot is approved
6. Future campaign generation binds to that approved snapshot

### User Outcome

The user can trust that generation is grounded in approved context instead of ad hoc prompts.

### Product Importance

This is one of the most important flows in the platform, even if end users may not fully understand it at first.

## Flow 4: Agent-First Workspace Use

### Goal

Let a user explore and operate the workspace conversationally.

### Entry Point

`/agent`

### Steps

1. User opens the AI agent view
2. User asks a workspace question or issues a task request
3. Agent selects tools such as:
   - list campaigns
   - list claims
   - list evidence
   - create campaign
   - generate angles
   - validate claim
4. Agent returns results in conversation
5. User either continues in chat or moves into a structured surface

### Common Prompts

- Show me my campaigns
- What claims need proof?
- Import my website
- What is my brand info?

### Product Outcome

The agent becomes a discovery and coordination layer across the product.

### Caveat

The agent should not become the only mental model. Structured surfaces still matter for reliability and repeatability.

## Flow 5: Campaign Creation

### Goal

Create a campaign entity and generate multiple assets from a brief.

### Entry Point

`/campaigns/new`

### Steps

1. User enters campaign basics:
   - name
   - audience
   - goal
   - offer
   - CTA
2. User selects asset types
3. User chooses formats by asset type
4. User chooses whether to validate claims and use templates
5. System creates the campaign record
6. System starts generation with streaming progress
7. System generates requested asset types
8. System persists campaign messages and asset documents
9. System marks campaign ready or partial

### User Outcome

The user receives a multi-asset campaign draft rather than a single output artifact.

### Product Intent

Campaigns are the structured production unit of the app.

## Flow 6: Launch Kit Creation

### Goal

Generate a launch-ready package from a guided wizard.

### Entry Point

`/kit/new`

### Steps

1. User chooses launch type
2. User fills out launch brief
3. User selects brand
4. System generates kit assets with progress updates
5. User reviews kit output across tabs
6. User exports or deploys kit assets through destinations that are marked live or beta

### Difference From Campaign Flow

Campaigns are the general production surface.
Launch kits are the opinionated packaged workflow for go-to-market launches.

### Product Outcome

The user gets a more guided and less open-ended experience than raw campaign creation.

## Flow 7: Claims Review and Compliance Resolution

### Goal

Resolve risky claims before publish, export, or deploy.

### Entry Point

- `/claims`
- `/compliance`
- compliance tab inside campaign or asset workflows

### Steps

1. System shows claims by status:
   - supported
   - weak
   - blocked
   - pending
2. User opens a claim
3. User reviews:
   - claim text
   - risk score
   - category
   - linked evidence
   - suggested rewrites
4. User chooses an action:
   - attach evidence
   - accept rewrite
   - edit content
   - override with audit trail
5. System updates claim and compliance status
6. Publish or deploy actions are unblocked when high-risk claims are resolved

### Product Outcome

Compliance becomes a working layer inside production, not a separate after-the-fact review process.

## Flow 8: Asset Editing

### Goal

Let users refine generated output before delivery.

### Entry Points

- campaign detail views
- asset editors
- canvas
- visual editor
- playground

### Steps

1. User opens a generated asset
2. User edits content, structure, layout, or theme
3. System preserves asset state, comments, and sometimes provenance
4. User re-runs compliance or review as needed
5. User moves asset toward final output

### User Outcome

The product supports human refinement rather than forcing one-shot generation.

## Flow 9: Requests Workflow

### Goal

Manage structured inbound work as a queue instead of informal chat or DMs.

### Entry Point

`/requests`

### Steps

1. User creates a request for an asset type
2. Request enters a workflow state:
   - new
   - in progress
   - review
   - approved
   - done
   - cancelled
3. Assignee or team reviews the brief
4. Work is created or edited
5. Feedback is attached
6. Request progresses to completion

### Product Outcome

The app supports internal demand management, not just content generation.

## Flow 10: Approval Workflow

### Goal

Support governance for sensitive content.

### Trigger

- campaign ready for review
- policy-sensitive asset
- enterprise or compliance-heavy workspace

### Steps

1. User submits content for approval
2. System attaches stages from a default or selected template
3. Reviewers approve, reject, request changes, or skip
4. System advances or terminates the approval instance
5. Approved content can move to publish or deploy

### Product Outcome

The product supports formal decision-making and auditability.

## Flow 11: Automation

### Goal

Generate recurring content with human control.

### Entry Point

`/automation`

### Steps

1. User creates or selects an automation rule
2. User picks schedule, content type, platforms, and brand context
3. System creates scheduled content items
4. Generated content enters pending review by default
5. User approves, rejects, or publishes

### Product Outcome

Automation increases throughput without silently bypassing review.

## Flow 12: Export and Publish

### Goal

Move approved assets into the outside world.

### Entry Points

- asset export actions
- campaign publish tab
- deploy routes
- launch kit export

### Steps

1. User chooses export or destination provider
2. System checks compliance gate
3. System checks provider connectivity
4. System either:
   - deploys directly
   - prepares export artifacts
   - falls back with instructions
5. System stores deployment state and results

### Product Outcome

The product closes the loop between generation and delivery.

## Flow 13: Human Escalation to Sako

### Goal

Move difficult or high-value work from AI into managed human execution.

### Trigger

- quality is not good enough
- user wants polish
- design or copy needs specialist work
- sensitive launch requires extra confidence

### Steps

1. User selects Send to Sako
2. User chooses task type and reason
3. System creates a local task and optional external sync
4. Task moves through statuses such as:
   - pending
   - assigned
   - in progress
   - review
   - completed
5. Deliverables return into the Composer workflow

### Product Outcome

The product captures work that would otherwise leave the platform entirely.

## Flow 14: Team Collaboration

### Goal

Support multiple operators and reviewers in the same workspace.

### Entry Points

- canvas
- comments
- private chat
- team views
- approvals

### Steps

1. Multiple users access the same workspace or project
2. Users comment, mention, review, and share
3. Presence, permissions, and status updates keep work coordinated
4. Team members move assets through review or deployment

### Product Outcome

The platform becomes a team workspace, not a solo-generation tool.

## Flow 15: Intelligence and Learning Loop

### Goal

Improve future outputs from prior workspace activity.

### Inputs

- imported brand context
- product facts and Brain snapshots
- campaign messages
- claim outcomes
- usage and publish history
- human feedback and escalation events

### Intended System Behavior

1. Learn which assets and templates are accepted
2. Learn which claims are repeatedly blocked
3. Improve future generation and recommendations
4. Surface health, prediction, and performance insights

### Reality Check

This appears directionally important in the product, but some learning and prediction surfaces are still earlier-stage than the core generation and compliance flows.

## Recommended Canonical User Journey

For product clarity, the default user journey should be:

1. Import brand
2. Review Brain context
3. Create campaign or launch kit
4. Generate assets
5. Resolve claims
6. Edit and approve
7. Export or deploy
8. Escalate to Sako only when needed

Everything else should support or accelerate that flow.

## Main Decision Points In The Product

At several points the user must decide:

- start in chat or structured workflow
- import first or manually create first
- generate campaign or launch kit
- self-serve edit or escalate to humans
- export manually or deploy directly
- approve now or queue for review

These decisions should be made clearer in product copy and navigation over time.

## User Flow Summary In One Sentence

Sako Composer is designed to move a team from brand import to governed content generation to compliant delivery, with clear review, approval, automation, and escalation paths around that core journey.
