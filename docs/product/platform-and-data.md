# Platform and data

This page covers how the system is built, the data model, and the rules that run a task: the lifecycle, the SLA clock, and day credits. I read the code to write the rules. Where the code differs from the original spec, the text says so.

## The parts

| Part | Folder | What it is |
|---|---|---|
| API | `platform/services/api` | NestJS API with Prisma and Postgres. Port 3001 |
| Client portal | `platform/apps/client` | React and Vite. See `client-portal.md` |
| Studio | `platform/apps/studio` | React and Vite. See `studio.md` |
| Review UI | `platform/packages/review-ui` | Shared review board used by the portal and Studio |
| Composer (GTM app) | `apps/gtm` | Next.js app on Supabase. A separate system |
| n8n | `n8n` | Automation workflows. See `sales-and-crm.md` |
| Landing, waitlist, wall | `apps/landing`, `apps/waitlist`, `apps/wall` | Marketing site, launch page, metrics screen. Not covered here |

Outside services the API uses: Clerk (sign-in), Stripe (payments), Slack, Resend (email), an S3-compatible bucket (files), Redis (queues), and OpenAI (the estimator and brief structuring).

### Original spec against the build

| Spec said | Code does |
|---|---|
| SvelteKit or Next.js for the apps | React and Vite for the portal and Studio. Next.js for Composer and the landing page |
| Supabase with row-level security for the main app | Postgres with Prisma. The API checks access in guards. There is no row-level security |
| Supabase Auth | Clerk. The API checks the Clerk token and creates the user on first call |
| One shared database for client and admin | True for the portal and Studio. Composer has its own Supabase database |
| Slack and Teams sync | Slack only |
| ProductFruits for onboarding | A small react-joyride tour |
| Notifications through Zapier webhooks | Built into the API: in-app, email (queue and Resend), Slack |
| Storage on Cloudflare R2 or Supabase | Any S3-compatible bucket, set by environment variables |

## The API

NestJS modules in `platform/services/api/src`:

| Module | Job |
|---|---|
| `auth` | Clerk token check, user creation, studio staff bootstrap |
| `workspace` | Workspaces, members, invites, dashboard data, credit history and forecast |
| `task` | Tasks, drafts, comments, attachments, the estimator, the SLA monitor, the websocket gateway, studio task actions |
| `review` | Review board: assets, versions, pinned comments |
| `brand` | Brand profiles |
| `subscription` | Pause, resume, cancel, un-cancel |
| `billing`, `stripe` | Plans, checkout, customer portal, webhooks, plan change |
| `credits` | Day credit burn and its daily job |
| `slack` | OAuth, channels, slash commands, events |
| `ai` | Brief structuring |
| `composer` | The gateway that an outside Composer app calls (capabilities, brands, Send to Sako) |
| `studio`, `admin` | Studio lists, client detail, metrics, user and admin management, enterprise workspaces |
| `marketing` | Lead capture and the nurture email series. See `sales-and-crm.md` |
| `queue` | BullMQ email queues on Redis |
| `search` | Global search |
| `common` | Notifications, mail, storage, analytics, guards |

How a call is checked:
1. The Clerk token is checked. A new user is created if needed.
2. The `x-workspace-id` header picks the workspace. The guard checks the user is a member. Studio routes skip this check.
3. A subscription guard lets read calls pass. It blocks write calls unless the plan is `ACTIVE` or `CANCEL_AT_PERIOD_END`. Some routes opt out.
4. Admin routes need the `ADMIN` role. The guard also allows a super admin.

The API does not check the workspace role (`OWNER`, `SUBMITTER`, `MEMBER`, `VIEWER`) on most routes. See `client-portal.md`.

### Jobs that run on a schedule

| Job | When | What it does |
|---|---|---|
| Day credit burn | Every day at 02:00 UTC | Burns 1 day credit per eligible workspace |
| SLA monitor | Every hour | Warns and escalates (see SLA clock) |
| Abandoned checkout cleanup | Every day at midnight | Cleans old checkout attempts |
| Marketing nurture | Every day at 10:00 | Sends the next lead email. A lock stops two copies from running at once |

The API process runs the first three. A second process, `worker.ts`, runs the email queues and the nurture schedule.

### Real-time updates

The task gateway sends `task:created` and `task:updated` to everyone in a workspace, and events for new review comments. The portal and Studio listen and reload.

## Plans

Plan names and prices as in the code (`platform/services/api/src/billing/plan.config.ts`, `platform/apps/client/src/config/plans.ts`).

| Plan code | Name | Monthly | Yearly | Active tasks | Seats | Day credits per cycle | AI credits |
|---|---|---|---|---|---|---|---|
| `CORE` | Core | $2,500 | $27,000 | 1 | 2 | 30 monthly, 365 yearly | Unlimited |
| `OPS` | Ops Base | $4,500 | $48,600 | 2 | 4 | 30 monthly, 365 yearly | Unlimited |
| `ENTERPRISE` | Enterprise | from $8,500 | from $91,800 | 3 or more | 5 or more | 30 monthly, 365 yearly | Unlimited |
| `COMPOSER_FREE` | Composer Free | free | free | 0 | 0 | none | 10 per month |
| `COMPOSER_PRO` | Composer Pro | $30 | $360 | 0 | 0 | none | 100 per month |

Notes:
- Core, Ops Base and Enterprise all include design and motion. Enterprise adds strategy. The spec had a separate Core Design plan and Core Motion plan. The code merged them into one Core plan. The old `mode` field on a subscription is marked deprecated.
- "Unlimited" AI credits is a large number (999999 in code). The screens show "Unlimited" at 100000 or more.
- The spec priced Enterprise from $10,500. The code and the product document use $8,500.
- The spec gave AI credits as 50, 75 and 100 or more per month. The code gives Studio plans unlimited credits and limits only the two Composer plans.
- Seats in the spec: 2, 5, unlimited. In code: 2, 4, 5.
- The Enterprise limits can be changed per workspace with a plan override (`workspace_plan_overrides`): active tasks, turnaround, a custom Stripe price. Studio can create such a workspace.
- All Stripe price IDs come from environment variables. The client app has test-price fallbacks. Replace them.

## Data model

The schema is `platform/services/api/prisma/schema.prisma`. It has 31 tables. Money is stored in cents.

### Enums

| Enum | Values |
|---|---|
| `PlanCode` | `CORE`, `OPS`, `ENTERPRISE`, `COMPOSER_FREE`, `COMPOSER_PRO` |
| `SubscriptionStatus` | `ACTIVE`, `PAST_DUE`, `CANCELED`, `PAUSED`, `CANCEL_AT_PERIOD_END` |
| `TaskStatus` | `QUEUED`, `IN_PROGRESS`, `IN_REVIEW`, `COMPLETED`, `PAUSED` |
| `TaskCategory` | `DESIGN`, `MOTION` |
| `TaskScope` | `DESIGN_ONLY`, `MOTION_ONLY`, `FULL` (on a plan) |
| `UserRole` | `CLIENT`, `PENDING_ADMIN`, `ADMIN` |
| `WorkspaceRole` | `OWNER`, `SUBMITTER`, `MEMBER`, `VIEWER` |
| `InviteStatus` | `PENDING`, `ACCEPTED`, `EXPIRED` |
| `CommentKind` | `COMMENT`, `REVISION_REQUEST`, `ADMIN_DECISION` |
| `IntegrationProvider` | `SLACK`, `LINEAR`, `JIRA`, `ASANA` (only Slack has code) |
| `SlackConnectStatus` | `NOT_CONNECTED`, `CONNECT_PENDING`, `CONNECTED` |
| `ReviewAssetType` | `IMAGE`, `PDF`, `VIDEO`, `FIGMA`, `LOTTIE`, `RIVE`, `EMBED` |
| `ReviewRevisionStatus` | `DRAFT`, `IN_REVIEW`, `APPROVED`, `CHANGES_REQUESTED` |
| `ReviewAnnotationKind` | `IMAGE_PIN`, `PDF_PIN`, `VIDEO_TIME`, `LOTTIE_TIME`, `RIVE_TIME`, `EMBED_REF` |
| `AnnotationSource` | `USER`, `AI` |
| `NotificationEventType` | 15 event types for task, review, billing and team events |
| `AiDraftType`, `AiDraftStatus`, `FigmaExportStatus`, `ComposerSource` | Used by Composer drafts |
| `MarketingEmailStep`, `MarketingEmailStatus`, `MarketingOfferKind` | Used by the nurture emails |

### Tables by group

**People and workspaces**

| Table | Key fields |
|---|---|
| `users` | id, Clerk user ID, email, name, `role` (`UserRole`), `isSuperAdmin` |
| `workspaces` | name, unique slug, `timezone`, `hasOnboarded`, plan link |
| `workspace_members` | workspace, user, `role` (`WorkspaceRole`). One row per user and workspace |
| `workspace_invites` | email, role, token, status. **No code uses this table** |

**Plans and billing**

| Table | Key fields |
|---|---|
| `plans` | code, name, `activeTaskLimit`, allowed categories, `taskScope`, monthly and yearly price |
| `subscriptions` | one per workspace: `status`, Stripe subscription ID, `planCode`, optional `activeTaskLimit` and `slaSeconds`, billing period start and end, `cancelAt`, `lastDayCreditBurnAt`, and pause fields (`pausedAt`, `pauseReason`, `totalPausedSeconds`) |
| `workspace_plan_overrides` | custom active tasks, turnaround, Stripe price, free-form metadata |
| `checkout_attempts` | Stripe session records, used to repair a checkout that did not finish |

**Work**

| Table | Key fields |
|---|---|
| `tasks` | workspace, brand, title, description, `category`, `status`, creator, assignee (unused), timestamps `inProgressAt`, `inReviewAt`, `completedAt`, `slaSeconds`, `totalClientWaitSeconds`, `revisionNumber`, structured brief and links as JSON, estimator fields, AI fields (`useAI`, `aiEligible`, `aiIneligibleReason`), Composer fields (`source`, `composerExportUrl`, draft status), Slack channel and thread, SLA fields (`slaWarningNotifiedAt`, `slaCreditIssuedAt`, `isEscalated`, `escalatedAt`) |
| `task_comments` | task, author, body, `kind` |
| `task_revisions` | task, author, revision index, JSON snapshot of the change |
| `attachments` | task, URL, kind (reference or deliverable) |
| `task_drafts` | a half-written brief for a workspace |
| `task_lifecycle_events` | task, kind, from and to status, actor role (client or admin), metadata. This is the audit log |
| `task_estimate_snapshots` | the estimator input and its raw output, linked to the task when created |
| `brands` | name, colors, extended palette, typography, layout preferences, tone tags, voice and general guidelines, logo and guideline links |

**Review board**

| Table | Key fields |
|---|---|
| `review_assets` | task, type, title, source URL |
| `review_asset_revisions` | asset, label (v1, v2, Final), `isCurrent`, status, reason, file URL |
| `review_annotations` | revision, author, kind, text, position or time payload, resolved flag, parent (threads), source |

**Credits**

| Table | Key fields |
|---|---|
| `day_credits` | workspace, total, used, period start and end |
| `day_credit_history` | action (`BURN`, `RESET`, `SLA_REFUND`), amount, balance before and after, notes |
| `ai_credits` | workspace, total, used, period start and end |

**Integrations and notices**

| Table | Key fields |
|---|---|
| `slack_integrations` | Slack team, bot token, default channel, connect status |
| `workspace_integrations`, `task_integration_links` | Generic provider tables. Not used by any live code path I found |
| `notifications` | user, type, title, message, payload, read flag |
| `notification_preferences` | user, event type, email, Slack and in-app switches |

**Composer and marketing**

| Table | Key fields |
|---|---|
| `ai_drafts` | A Composer draft linked to a workspace, brand and task: HTML, design JSON, status, Figma export status, rating |
| `marketing_leads` | email, source, UTM fields, converted and unsubscribed flags |
| `marketing_email_sends` | lead, step (D0, D1, D3, D5, D10), status. One send per lead and step |
| `marketing_offers` | lead, coupon or payment link, percent off, expiry |

### Spec tables against the schema

| Spec table | In the schema |
|---|---|
| `users` | `users` (roles changed, see `studio.md`) |
| `clients` | `workspaces` plus `workspace_members`. A user can belong to many workspaces |
| `tasks` | `tasks`. One flat table |
| `subtasks` | **Not built** |
| `comments` | `task_comments` |
| `files` | `attachments`, and `review_assets` for deliverables |
| `versions` | `review_assets` and `review_asset_revisions` |
| `ai_estimates` | `task_estimate_snapshots` |
| `ai_credits` | `ai_credits` (one row per billing period) |
| `status_logs` and `activity_logs` | `task_lifecycle_events` (task events only) |
| `revisions` | `task_revisions`, and `revisionNumber` on the task |
| `subscriptions` | `subscriptions`, `plans`, `workspace_plan_overrides` |
| `task_templates` | **Not built.** `task_drafts` is a different thing |
| `onboarding_checklist` | `workspaces.hasOnboarded` only |
| `brand_docs` | `brands` (no document upload) |
| `strategy_calls` | **Not built** |
| `teams`, `team_members`, `assignments` | **Not built.** `tasks.assignedToId` exists and nothing writes it |
| `crm_leads`, `crm_followups`, `admin_notes` | **Not built** in the platform. `marketing_leads` is a different tool |

Tables the spec did not have: `plans`, `checkout_attempts`, `slack_integrations`, `notifications`, `notification_preferences`, `task_drafts`, `day_credits`, `day_credit_history`, the three review tables, `ai_drafts`, and the three marketing tables.

## Task lifecycle

A task has one of five states.

| State | Meaning |
|---|---|
| `QUEUED` | Submitted. Waiting for the studio to start it |
| `IN_PROGRESS` | The studio is working. The SLA clock runs |
| `IN_REVIEW` | A delivery waits for the client. The SLA clock is stopped |
| `COMPLETED` | The client approved |
| `PAUSED` | Set by the studio. Rare |

### Moves

| Move | Who | What happens |
|---|---|---|
| Create, state `QUEUED` | Client | A paused or cancelled plan cannot create. The category must fit the plan. If "Use AI" is on, 1 AI credit is spent. The SLA length (default 48 hours) is copied onto the task |
| Create from Composer | Composer app | Allowed only on Core, Ops Base and Enterprise. The task starts as `IN_PROGRESS` if an active slot is free, else `QUEUED` |
| `QUEUED` to `IN_PROGRESS` | Studio | The plan must be `ACTIVE` or `CANCEL_AT_PERIOD_END`. The active-slot limit must have room. Sets `inProgressAt`. Notifies the creator |
| `IN_PROGRESS` to `IN_REVIEW` | Studio | Sets `inReviewAt`. Notifies the creator |
| `IN_REVIEW` to `COMPLETED` | Client | Sets `completedAt`. Adds the review wait to `totalClientWaitSeconds`. Checks for a late SLA (see SLA credit). Studio can also do this through the board |
| `IN_REVIEW` to `IN_PROGRESS` | Client: request revision | Needs a free slot. `revisionNumber` goes up by 1. `inProgressAt` is set to now. The review wait is added to `totalClientWaitSeconds`. A `task_revisions` row, a revision comment and a lifecycle event are saved. Editing a task in review also counts as a revision request |
| `IN_REVIEW` to `IN_PROGRESS` | Studio: rework | Same clock changes, but `revisionNumber` does not change |
| `IN_PROGRESS` and `PAUSED` | Studio | Moving back to `IN_PROGRESS` checks the slot limit |

Other rules:
- A client may only move `IN_REVIEW` to `COMPLETED`, or ask for a revision. The API refuses other client moves.
- A client can edit title, brief, category and brand only while the task is `QUEUED` (an edit in `IN_REVIEW` is a revision request). A client can delete only a `QUEUED` task.
- The API has a function that starts the next queued task when a slot opens. The call is turned off in the code (a comment says "only admin starts tasks"). Only a studio admin starts tasks, except for Composer tasks.
- Every move writes a `task_lifecycle_events` row and posts to Slack when Slack is connected.

### Active slots

The limit comes from the first value found: plan override, then the subscription's own limit, then the plan limit, then 1.

A slot counts a task in `IN_PROGRESS` or `IN_REVIEW`. A task that waits for client review still holds its slot. `QUEUED`, `COMPLETED` and `PAUSED` tasks do not.

The workspace dashboard data counts only `IN_PROGRESS` tasks as active. It can show a lower number than the limit check uses.

### SLA clock

The default SLA is 48 hours (172800 seconds). The value comes from the subscription (`slaSeconds`) or an enterprise override. It is copied to each task at creation.

The clock is in `platform/services/api/src/common/utils/sla.util.ts`:
- It starts at `inProgressAt`.
- Elapsed time = (now, or the end time) minus `inProgressAt`, minus the subscription's total paused time, minus `totalClientWaitSeconds`.
- While a task is `IN_REVIEW`, the end time is `inReviewAt`. The clock is frozen.
- While the subscription is `PAUSED`, the end time is the pause start. The clock is frozen.
- When a task is completed, the end time is `completedAt`.
- Remaining = SLA seconds minus elapsed. Late means remaining is below zero.

What the portal shows: a live timer for tasks in progress, a frozen value for tasks in review or paused plans, and the final result for completed tasks. The estimator also gives an "estimated SLA" between 24 hours and the standard SLA. This is shown to the client. It does not change the real clock.

Three details to know:
1. On a revision, `inProgressAt` is set to now, and `totalClientWaitSeconds` keeps the earlier total. The formula subtracts that total from the new run. The clock for a revision can therefore show less elapsed time than real time.
2. The subscription pause total is subtracted from every task. It is not limited to pauses that happened while the task was open.
3. A task in the `PAUSED` task state is not frozen. Only a paused subscription and `IN_REVIEW` freeze the clock.

The hourly SLA monitor looks at tasks in `IN_PROGRESS`:
- If a task is within 6 hours of its deadline and was not warned yet, it sends one warning to the task creator (`slaWarningNotifiedAt`).
- If a task is late and not escalated yet, it sets `isEscalated` and `escalatedAt` and sends an "SLA missed" notice to the creator.

The spec asked for an alert at 12 hours before the deadline in one place and 24 to 36 hours of being stuck in another. The code warns at 6 hours.

### SLA credit

When a client completes a task and the SLA was missed, the API adds 1 day credit to the current period (`totalCredits` goes up by 1). It writes a `day_credit_history` row with action `SLA_REFUND` and tells the creator. `slaCreditIssuedAt` stops a second credit for the same task. A failure here does not block the completion.

This rule was not in the original specs.

## Day credits

A day credit is a ledger of paid days. It is not a count of working days per task.

**How many.** A new billing period gets 30 credits on a monthly plan and 365 on a yearly plan. The API makes the rows when Stripe confirms checkout or an invoice is paid.

**How they burn.** The daily job at 02:00 UTC burns 1 credit per workspace. It does this whatever the number of tasks. The rules in `platform/services/api/src/credits/day-credit-burn.service.ts`:
- Skip a workspace with a `PAUSED` subscription.
- Burn at most once per day. `lastDayCreditBurnAt` is the guard.
- Do nothing when no credit period is active or when used credits already equal the total.
- Write a `day_credit_history` row with action `BURN`.

The burn also runs when a workspace's data loads, if today's burn has not happened. This repairs a missed job.

**This differs from the product document.** That document said a day credit is used when the pod works on a task, so two tasks for a day use two credits. In the code, one credit burns per day per workspace, even with no task open, and no task action spends a credit. Comments in the task code say so: "Day credits are burned once per day via scheduler, not per task transition."

**No hard stop.** I found no check that blocks a task when credits reach zero. The burn just stops. The day-credit number is for display and for the audit trail.

**Pause and rollover.**
- Pausing stops the burn and freezes SLA clocks.
- When a new period starts, unused credits from the last period are added to the new total. This happens only when the workspace's total paused time is within the limit: 3 months on a monthly plan, 6 months on a yearly plan. Over the limit, the unused credits are dropped.
- The product document said credits are valid for 30 days (monthly) or 365 days (yearly). The code matches: a period is one billing period.

**Timezone.** The workspace timezone is saved. The burn does not use it. It uses UTC.

**Edge cases in the code.**
- The daily job selects subscriptions with status `ACTIVE` or `CANCELED`. The burn function skips only `PAUSED`. A subscription in `CANCEL_AT_PERIOD_END` is not picked up by the job, but the on-load burn can still burn for it.
- The comment in the file says `PAST_DUE` is skipped. The code does not skip it.
- The history note in the schema lists `ROLLOVER` and `REFUND`. The code writes `RESET` (with a note that says rollover) and `SLA_REFUND`.

## AI credits

- Studio plans have unlimited AI credits. Composer Free has 10 per month and Composer Pro has 100.
- In the platform, 1 AI credit is spent when a task is created with "Use AI" on. The estimator and the brief structuring cost nothing.
- There is no screen to buy more credits. Studio has no screen to add credits by hand.

## Subscription states

| Status | How it is set | Effect |
|---|---|---|
| `ACTIVE` | Stripe says active or trialing | Full use |
| `PAUSED` | Owner pauses. Stripe stops collection | No new tasks. No burn. SLA frozen |
| `CANCEL_AT_PERIOD_END` | Owner cancels | Works like `ACTIVE` until the period ends |
| `CANCELED` | Stripe says cancelled or unpaid | No new tasks |
| `PAST_DUE` | Stripe says past due | Set from Stripe. Screens read it as a problem state |

Stripe webhooks that the API handles: checkout completed, subscription created, updated, deleted, paused, resumed, invoice paid, invoice payment succeeded, invoice payment failed, and a few others that only log.

## Composer (the GTM app)

Composer in the spec was a small tool: landing pages, decks and social posts. The built `apps/gtm` is a much larger product.

- Stack: Next.js on Supabase, with its own sign-in and its own database (a single baseline file of 188 tables).
- Areas in the app routes: an agent, campaigns, brand DNA, claims and evidence (a compliance check), competitors, newsletters, a landing page playground and editor, a canvas, ads, audiences, affiliates, analytics, integrations, requests and Sako tasks.
- The spec said all apps share one Clerk login. They do not. Composer uses Supabase sign-in.
- The platform API has a gateway for an outside Composer app (`composer/capabilities`, `composer/brands`, `composer/tasks/from-draft`, `composer/sso-token`) and a Studio route for tasks from Composer. The API code says it does no generation itself.
- Composer keeps its own `sako_tasks` table. It can call the platform API when `SAKO_V1_API_URL` and `SAKO_V1_API_KEY` are set. It calls `composer/tasks/escalate`, `composer/tasks/:id` and `composer/tasks/:id/cancel`. The platform API has none of those three routes, and it signs in callers with Clerk tokens, not an API key. I read this as an unfinished link. Treat "Send to Sako" from the GTM app as **Partly built**.
- Some GTM pages return 404 or "No workspace found". This is a known issue.

The spec's Composer plan rules (free and pro credits, Send to Studio only on Core and above) are in the platform API. The GTM app's own billing is separate.
