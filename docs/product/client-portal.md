# Client portal

The client portal is where a paying customer asks for design work and approves it. It is a React and Vite app.

- Code: `platform/apps/client/src`
- Routes: `platform/apps/client/src/App.tsx`
- API it talks to: `platform/services/api/src`

This page began as the Client Dashboard PRD. It now describes what the code does. Each feature has a Status line:

- **Built**: the code exists and I read it. The file or route is named.
- **Partly built**: some of it exists. The text says what I saw and what is missing.
- **Planned, not built**: the original spec asked for it. I found no code for it.

## Routes that exist

| Route | Screen | Needs sign-in |
|---|---|---|
| `/sign-in`, `/sign-up` | Clerk sign-in and sign-up | No |
| `/pricing` | Plan picker (Stripe pricing table) | No |
| `/redeem` | Promo link that opens Stripe checkout | No |
| `/billing/success` | Wait screen after payment | Yes |
| `/` | Dashboard | Yes |
| `/tasks` | Task list and board | Yes |
| `/tasks/new` | New task form | Yes |
| `/tasks/:id` | Task detail and review | Yes |
| `/calendar` | Calendar, SLA timeline, capacity | Yes |
| `/brands` | Brand profiles | Yes |
| `/settings` | Profile, organization, team, notifications, security, integrations, billing | Yes |

The original spec also listed `/uploads`, `/templates`, `/docs`, `/credits` and `/team`. None of these routes exist. Their jobs are covered in other places or not covered. See the end of this page.

## Who can do what

The spec had four roles: Owner, Editor, Submitter, Viewer. The code has four roles with different names: `OWNER`, `SUBMITTER`, `MEMBER`, `VIEWER`.

| Role | What the screens allow |
|---|---|
| OWNER | Everything: settings, team, billing, pause and cancel, create tasks, review |
| SUBMITTER | Create tasks, review, view |
| MEMBER | Same as SUBMITTER in the screens |
| VIEWER | View only. The new task page sends a viewer away |

Status: **Partly built.** The role table is in `platform/apps/client/src/lib/WorkspaceProvider.tsx`. It hides buttons and screens. The API does not check the role on most calls. I saw an owner check only when a workspace name or timezone is changed (`platform/services/api/src/workspace/workspace.controller.ts`). Inviting people, changing roles, creating tasks, and pausing or cancelling the plan do not check the role of the caller in the API. Treat the roles as a screen feature until you add API checks.

## Sign-up and workspace creation

**What it is for.** A new customer pays first. The workspace is created after payment.

**Flow.**
1. The visitor signs up with Clerk.
2. The visitor picks a plan on `/pricing`. Stripe Checkout takes the payment.
3. Stripe calls the API webhook. The API creates the workspace, the subscription, the day credits and the AI credits.
4. The portal shows "Setting up your workspace" and checks again every 2 seconds, up to 5 times. Then it opens the dashboard.
5. A signed-in customer with no workspace goes back to `/pricing`.

**Status:** **Built** for the flow (`components/AppShellGate.tsx`, `pages/onboarding/BillingSuccessPage.tsx`, `services/api/src/stripe/stripe-events.service.ts`).

**Pricing page status:** **Partly built.** The page shows a Stripe pricing table. The table ID and the public key come from environment variables. The code has a fallback ID from the original Stripe account. It will not work for you. Make your own pricing table in Stripe and set the variables. This is a known issue.

**Promo link:** **Built.** `/redeem?code=...` asks the API for a Stripe checkout session with the discount (`pages/RedeemPage.tsx`, API route `stripe/create-checkout-session-redeem`).

## Dashboard

**What it is for.** One page that shows the state of the account.

**What it shows.**
- Plan and subscription status. A paused plan shows "Payment collection paused".
- Day credits used and left, with a forecast. The forecast says if credits last to the end of the period, and how many may roll over.
- A Composer card. It says Composer credits are included in the plan.
- Active tasks (in progress), tasks that wait for your review, and saved drafts.
- Quality and speed: average turnaround over 30 days, first-pass acceptance, tasks completed in 30 days.
- A "Book strategy call" card. It shows only when a booking link is set in `VITE_STRATEGY_CALL_URL`.
- An "Upcoming calls" card.

**Status:** **Partly built.** The page is `components/client/Dashboard.tsx`. Everything above reads real data except "Upcoming calls". That card is fixed text: "No upcoming calls scheduled". The spec asked for a quick-stats row, a Book Call action, global search in the top bar, and an Import CSV action. Search exists (see Global search). CSV import does not.

## Create a task

**What it is for.** The customer writes a brief. The studio does the work.

**Flow.**
1. The customer opens `/tasks/new`.
2. The form has: title, category (Design or Motion), brand (optional), and the brief.
3. The customer can press the AI button. It structures the brief into goal, audience, funnel stage, asset type, key message and tone. Then it runs the estimator.
4. The customer can add reference links, attach files, and say if they want a Figma file, a Drive link, or a video reference.
5. A switch says "Use AI for this task". It costs 1 AI credit.
6. The customer can save a draft, or submit.
7. If "Use AI" is on and the estimator marks the task as complex or unsupported, the portal asks the customer to confirm.
8. The task is created with status `QUEUED`. Files upload after the task exists. The customer lands on the task page.

**The estimator** returns: complexity (simple, complex, unsupported), effort in hours (kept between 8 and 80), a delivery expectation (kept between 24 hours and the standard SLA), a flag for admin review, a "does it fit 48 hours" answer, suggested subtasks, questions about missing information, and a hint if AI can help. The estimator costs no credits. It uses an OpenAI model. If no OpenAI key is set, the API returns a fixed fallback answer (`platform/services/api/src/ai/ai.service.ts`, `task/task-estimator.service.ts`).

**Rules the API enforces.** A paused plan cannot create tasks. A cancelled plan cannot create tasks. The category must be allowed by the plan. If "Use AI" is on and no AI credit is left, the API refuses the task.

**Status:** **Built** (`components/client/TaskCreate.tsx`, `services/api/src/task/task.service.ts`, `services/api/src/ai`).

Differences from the spec:
- No tags field. No "due date request" field. The API has no due date on a task.
- Reference files: the API accepts up to 50 MB per attachment. The spec said 2 GB.
- The "AI usage" choice is one switch for the whole task. The spec had a checkbox per type (image, content, voice).
- Bulk CSV import: **Planned, not built.** No code.

## Drafts

**What it is for.** Keep a half-written brief.

**Flow.** The customer presses Save draft. The draft shows on the dashboard. The customer opens it with `?draftId=`. The API can also submit a draft directly (`tasks/drafts/:id/submit`).

**Status:** **Built** (`TaskCreate.tsx`, table `task_drafts`, routes under `tasks/drafts`).

## Task list and board

**What it is for.** See all work and its status.

**Flow.** The page `/tasks` has a list view and a board view. The choice is saved in the browser. The customer can search by title and filter by status. In the board, the customer can drag a card from In Review to Completed. Any other drag shows a message: only the studio moves a task into progress or review.

**Status:** **Built** (`components/client/ClientTasks.tsx`). Search is on the title only, and it runs in the browser. Filters by plan and by date range, from the spec, are not built.

## Task detail

**What it is for.** One page for one request: the brief, the clock, the talk, the files.

**What it shows.**
- Title, category, brand, status, and the revision number.
- The SLA block: a live timer while the task is in progress (see `platform-and-data.md` for the rules).
- The brief, the structured brief, and the AI estimate.
- A comment thread. The customer can post a comment. Revision requests show in the thread with a label. While the task is in review or completed, the review board has its own comment side panel and this thread is hidden.
- Attachments: add and remove. The attachments panel hides while the task is in review.
- A link to open Composer, when the task has a brand.
- Actions: duplicate the task (it fills the new task form with the same brief), and delete the task (only while it is `QUEUED`).
- When the task is `IN_REVIEW` or `COMPLETED`: the review board and a download list of deliverables.
- A banner when the task is paused.

**Status:** **Built** (`components/client/TaskDetail.tsx`). Live updates come over a websocket (`task:updated`).

**The spec's "master task and subtask" model is Planned, not built.** There is one flat task. There is no subtask table, no subtask assignee, and no per-subtask due date.

## Review and approval

**What it is for.** The customer checks the delivery and says yes or asks for changes.

**Flow.**
1. The studio uploads a deliverable and moves the task to `IN_REVIEW`. The customer gets a notification.
2. The task page shows the review board. It lists each deliverable asset and its versions (v1, v2, Final).
3. The customer opens a version. The viewer depends on the type: image, PDF, video, Figma, Lottie, Rive, or an embed.
4. The customer leaves pinned comments. On an image or PDF the pin has a position. On video, Lottie and Rive the pin has a time. Comments have threads and can be resolved.
5. The customer picks one:
   - **Approve.** The task becomes `COMPLETED`.
   - **Request changes.** The task goes back to `IN_PROGRESS`, the revision number goes up by 1, and the feedback is saved as a revision comment.
6. A completed task shows the board as read-only.

**Status:** **Built** (`components/client/review/ReviewBoard.tsx`, shared package `platform/packages/review-ui`, API `services/api/src/review`). New comments and versions reach the other side live.

Differences from the spec:
- The spec's "version diff" view is not built. The board shows one version at a time.
- The enum has an `AI` source for comments. I found no code that creates AI comments.
- Upload limits in code: 50 MB for task attachments, 100 MB for a review version. The spec said 2 GB. For larger files, share a link in a comment.
- Lottie and Rive have their own viewers. I did not find a special viewer for GIF.

## Calendar

**What it is for.** See deadlines and how full the queue is.

**Flow.** `/calendar` has three tabs: a month calendar, an SLA timeline (active tasks sorted by deadline), and capacity planning (active slots, queued, in review, utilization).

**Status:** **Built** (`components/client/Calendar.tsx`). The spec's calendar was for strategy calls too. Calls are not shown here.

## Brands

**What it is for.** Store the brand once so every task and Composer draft can use it. In the spec this was the "Knowledge base".

**Flow.** The customer opens `/brands` and creates a brand. The editor has: name, tone tags, voice guidelines, general guidelines, a color palette with gradients, typography (heading font, body font, scale, weights), and layout preferences (hero style, call-to-action style). The customer picks a brand on a new task.

**Status:** **Built** (`components/client/Brands.tsx`, API route `brands`).

Not built from the spec: uploading a brand PDF, and clicking on a brand document to leave a comment. The table has a field for a logo link and a guideline link. The screen has no input for them.

## Team and roles

**What it is for.** Add colleagues to the workspace.

**Flow.** In Settings, the Team tab lists members with their role. The owner types an email and a role to add a person. The API adds the person at once and sends an email. There is no accept step. The owner can change a role and remove a member (not the owner).

**Seat limits:** Core 2, Ops 4, Enterprise 5. The API refuses an invite over the limit.

**Status:** **Partly built.** It works (`components/client/Settings.tsx`, `services/api/src/workspace/workspace.service.ts`). The `workspace_invites` table exists, but no code uses it. The spec asked for an org chart with drag and drop, per-task visibility rules, and "Unlimited" seats on Enterprise. Those are not built. The spec's Owner, Editor, Submitter, Viewer became the four names above.

## Settings

**Status:** **Built.** One page, `components/client/Settings.tsx`, with these tabs:

| Tab | What it does |
|---|---|
| Profile | Shows name and email. The name is managed in Clerk. |
| Organization | Owner sets the workspace name and timezone. |
| Team | See Team and roles. |
| Integrations | Connect Slack. See Slack. |
| Notifications | A grid: event groups against Email, Slack, In-app. |
| Security | Change password through Clerk. |
| Billing | Plan, status, day credits. Pause, resume, cancel, un-cancel. Upgrade options. A button to open the Stripe customer portal. |

The timezone is saved. The credit burn and the SLA clock do not use it (see `platform-and-data.md`). Auto-detecting the timezone from Slack is **Planned, not built**.

## Pause, cancel and plan change

**What it is for.** The customer stops or changes the plan without writing to support.

**Flow.**
- **Pause.** The owner presses Pause on the Billing tab. Stripe stops collecting payment. Day credits stop burning. The SLA clock freezes. New tasks are blocked. The screen shows how long the pause has lasted and how long the credits can still roll over (3 months on a monthly plan, 6 on an annual plan).
- **Resume.** Payment, credits and the clock start again.
- **Cancel.** The plan stays fully active to the end of the billing period. New tasks are still allowed until then. When Stripe reports the subscription as cancelled, the status becomes cancelled and new tasks are blocked.
- **Un-cancel.** Undo a cancel before the period ends.
- **Upgrade.** The Billing tab lists higher plans. The Stripe portal handles card changes and invoices.

**Status:** **Built** (`Settings.tsx`, `components/client/PauseStatus.tsx`, `services/api/src/subscription`, `services/api/src/billing`, `services/api/src/stripe`).

## Notifications

**What it is for.** Tell people when something needs them.

**Flow.** A bell in the top bar shows in-app items. The API also sends email (through a queue and Resend) and Slack messages. Each person picks channels per event group in Settings.

**Events in the code:** task created, in progress, in review, completed, task comment, revision requested, new version uploaded, review comment, payment failed, plan paused, resumed, cancelled, invite, member joined, member removed, SLA warning, SLA missed, SLA credit issued.

**Status:** **Built** (`components/client/NotificationBell.tsx`, `services/api/src/common/notifications`).

## Slack

**What it is for.** Let the customer work from Slack.

**Flow.**
1. The owner connects Slack with OAuth, picks a default channel, and sends a test message.
2. Task changes post to the channel.
3. A person can type `/sako create <text>` to make a task, `/sako status` for a summary, `/sako compose` for a Composer link, and `/sako help`.
4. The bot also reacts to direct messages, mentions, and the App Home tab.

**Status:** **Built** (`Settings.tsx`, `services/api/src/slack`). Mirroring a comment thread between Slack and the portal is not built. Microsoft Teams is **Planned, not built**. The schema lists Linear, Jira and Asana as providers, but no code uses them. The studio settings show Linear as "Coming soon".

## Composer link

**What it is for.** Open the AI design workspace from the portal.

**Flow.** The task page shows an "Open Composer" button when the task has a brand. It opens the Composer app. The Composer app can send a draft back as a task through the API ("Send to Sako").

**Status:** **Partly built.** The side nav still shows "Composer (coming soon)" and does not link anywhere. The task button opens the address in `VITE_COMPOSER_URL`, which defaults to a local port. The API has the "Send to Sako" route (`composer/tasks/from-draft`, `studio/tasks/from-composer`). Composer itself is a separate app. See `platform-and-data.md`.

## Global search

**Flow.** The top bar search looks in tasks (title and description) and in workspaces (name and slug). A person with several workspaces can jump to one.

**Status:** **Built** (`components/client/GlobalSearch.tsx`, `services/api/src/search`). It does not search tags (tasks have none) or file content.

## Onboarding tour

**What it is for.** Help a new customer start.

**Flow.** A two-step tour points at Brands, then at the New task button.

**Status:** **Built**, but it is small. It uses the react-joyride library (`components/ProductTour.tsx`). The spec named ProductFruits, a checklist, a help button and an FAQ. Those are not built.

## Strategy calls

**What it is for.** Book a planning call.

**Flow.** If `VITE_STRATEGY_CALL_URL` is set, the dashboard shows a card with a booking button that opens that link.

**Status:** **Partly built.** Only the link button exists. Calendar sync, a list of past and future calls, and call notes are not built. The spec limited calls to higher plans. The card shows to every plan.

## Not built

These items from the original client spec have no code:

- Uploads page, with a 2 GB limit and an external-link rule.
- Task templates page. Only "duplicate this task" exists.
- Docs page, and brand PDF annotation.
- Credits page. The dashboard has a credits card, and the API has history and forecast routes. No screen uses the history route.
- Analytics page: charts for turnaround, credit use, revisions per task.
- Master task with subtasks, assignees and due dates.
- CSV bulk import.
- Purchase more AI credits.
- Per-task visibility rules.
- Microsoft Teams sync, Google Calendar or Calendly sync.
- Forecast of credits before a task is sent (the dashboard forecast is about day credits, not per task).
