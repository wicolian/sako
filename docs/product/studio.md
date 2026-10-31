# Studio

Studio is the app for the Sako design team. Operators and designers use it to pick up client requests, deliver work, and watch the queue. It is a React and Vite app.

- Code: `platform/apps/studio/src`
- Routes: `platform/apps/studio/src/App.tsx`
- API: `platform/services/api/src` (routes under `studio`, `admin`, and `admin/tasks`)

This page began as the Admin Dashboard PRD. The spec called the app "Admin" and used paths such as `/admin/tasks`. The built app is called Studio and uses paths under `/studio`. Each feature below has a Status line:

- **Built**: the code exists and I read it.
- **Partly built**: some of it exists. The text says what is missing.
- **Planned, not built**: the spec asked for it. I found no code.

## Routes that exist

| Route | Screen |
|---|---|
| `/sign-in` | Clerk sign-in |
| `/studio/dashboard` | Dashboard |
| `/studio/tasks` | All tasks: list and board |
| `/studio/tasks/:id` | Task workspace |
| `/studio/kanban` | Redirects to `/studio/tasks` |
| `/studio/clients`, `/studio/clients/:id` | Client list and client detail |
| `/studio/calendar` | Month calendar |
| `/studio/billing` | Billing inspector |
| `/studio/settings` | Profile, notifications, integrations |
| `/studio/ai` | AI readiness page |
| `/studio/pods` | Placeholder |
| `/studio/admin/pending-admins` | Admin management |
| `/studio/admin/users` | User management |
| `/studio/admin/clients` | Create enterprise clients |

The spec listed `/admin/teams`, `/admin/my-tasks`, `/admin/revisions`, `/admin/logs`, `/admin/ai-credits`, `/admin/crm` and `/admin/strategy-calls`. None of these exist.

## Who can use Studio

The spec had four roles: Super Admin, Admin, Team Member, Sales. The code has a simpler model.

| Part | Values |
|---|---|
| `UserRole` | `CLIENT`, `PENDING_ADMIN`, `ADMIN` |
| `isSuperAdmin` | A flag on the user |

How it works:
1. Studio needs the `ADMIN` role.
2. A new user who signs in with a staff email domain starts as `PENDING_ADMIN`. The domains come from the `ALLOWED_STUDIO_DOMAINS` variable. If it is not set, the code uses a default list that holds the original company's domains. Set your own. The first such user becomes `ADMIN` and super admin.
3. An admin opens User Management or Admin Management. The admin promotes, demotes or rejects people. Only a super admin can promote and demote.
4. A pending user cannot use the Studio API.

**Status:** **Built** (`components/auth/StudioProtectedRoute.tsx`, `pages/admin/AdminUsersPage.tsx`, `pages/PendingAdminsPage.tsx`, `services/api/src/admin/admin-users.controller.ts`, `services/api/src/auth/clerk-auth.guard.ts`).

**Not built from the spec:** the Team Member role (a designer who sees only assigned work) and the Sales role. Every admin sees every task and every client. The spec's powers matrix (for example, only a super admin can assign) is not enforced.

## Dashboard

**What it is for.** A quick view of the studio.

**What it shows by default.**
- Active clients, active tasks (in progress), and a "quality and speed" card: average turnaround, first-pass rate, tasks completed in 30 days.
- The 4 newest tasks and the 3 newest clients.
- A developer button to run the daily day-credit burn for all workspaces.

**Status:** **Partly built** (`components/AdminDashboard.tsx`). The numbers above are real. The page also holds panels with made-up sample data: calls, pods and stages, pod load, and upcoming invoices. These panels are hidden by flags in `platform/apps/studio/src/config/features.ts` (`pods` and `advancedAnalytics`, both off). Do not turn them on and read them as real data. The first-pass rate and turnaround come from `studio/metrics`.

## All tasks (list and board)

**What it is for.** Work the queue across all clients.

**Flow.**
1. `/studio/tasks` shows every task from every client. The view is a list or a board with columns for each status. The choice is saved in the browser.
2. The admin can search by title and filter by status.
3. The admin drags a card to change status:
   - Queued to In Progress calls the start route. The API checks the plan's active-task limit and that the plan is active.
   - In Progress to In Review calls the review route.
   - Other moves (for example Paused to In Progress) use a general update route.
4. If the limit is reached, a message says to complete or pause an active task first.

**Status:** **Built** (`components/AdminTasks.tsx`, `services/api/src/task/admin-task.controller.ts`). The spec's separate "flagged tasks" tab is not built. The task detail shows the flag instead. A filter by client, plan or team is not built. A category filter exists in the code, but the screen shows no control for it.

## Task workspace

**What it is for.** The designer's page for one request.

**What it shows.**
- The brief, structured brief, key goals and reference links.
- The brand profile: colors, typography, guidelines.
- The AI estimate: effort, suggested turnaround, "fits 48 hours", and any reason AI is not allowed.
- Task info: created, started and completed times, time remaining, elapsed time.
- Client files (attachments).
- Revision history and the comment thread.
- Workspace summary for the client.

**Actions.**
- **Start task.** Queued to In Progress. This starts the SLA clock.
- **Add a deliverable.** Upload a file, or add a link (Figma, Lottie and others). A link shows a live preview for Figma and Lottie.
- **Send to review.** In Progress to In Review. The SLA clock stops while the client reviews.
- **Add a new version** of a deliverable in the review board.
- **Mark complete.** The task page has a "Mark Completed" button for a task in review. The button calls `POST admin/tasks/:id/complete`. I found no such route in the API, so the button fails. An admin can still drag the card from In Review to Completed on the board. The general update route allows it. The spec said only the client can complete a task.
- **Comment.** The comment is visible to the client. There are no private internal notes.
- **Approve or reject scope.** This changes the AI-eligible flag and adds a decision comment to the thread. It does not move the task. The spec said "Approve moves to In Progress".
- **Mark AI-ineligible.** Add a reason. It is shown to the client.
- **Duplicate** a task. The button calls `POST admin/tasks/:id/duplicate`. I found no such route in the admin API, so the button fails. (The client API has `tasks/:id/duplicate`.) **Delete** a task. The button shows only for queued tasks.

**Status:** **Partly built** (`components/AdminTaskDetail.tsx`, `components/review/StudioReviewBoard.tsx`, `services/api/src/task/admin-task.controller.ts`). Start, review, deliverables, comments, scope decisions and delete work. Mark Completed and Duplicate call API routes that do not exist.

**Assignment and priority are not built.** The Assignment panel shows a fixed "Sako" assignee and four priority buttons that do nothing. The schema has `assignedToId` on a task. No API route sets it. Team pools, claiming a task, and direct assignment from the spec are **Planned, not built**.

## Review board in Studio

**What it is for.** Deliver work in a way the client can review.

**Flow.** The admin adds a deliverable asset to a task. The board shows versions and the client's pinned comments. The admin replies, resolves comments, and uploads a new version when changes are requested. The client sees the same board.

**Status:** **Built** (`components/review/StudioReviewBoard.tsx`, shared package `platform/packages/review-ui`). New version upload accepts a file up to 100 MB or a URL.

## Revisions queue

**What it is for.** Find tasks where the client asked for changes.

**Status:** **Partly built.** There is no revisions tab. A request for changes moves the task back to In Progress, adds 1 to the revision number, and adds a revision-request comment. The admin sees this on the board and in the task detail. The admin Slack channel also gets a message (see Notifications).

## Clients

**What it is for.** See each customer workspace.

**Flow.** `/studio/clients` lists workspaces with queued tasks, active tasks and status. A click opens the client detail: active slots, timezone, day credits (left and total, renewal date), AI credits, an active-tasks list, an in-review list, and the 4 latest tasks.

**Status:** **Built** (`components/AdminClientsList.tsx`, `components/AdminClientDetail.tsx`, API `studio/clients`).

Not built from the spec: pause or cancel a client from Studio, move a client to another team, and a manual plan change. The client can pause and cancel in the portal. A manual AI-credit top-up has no screen.

## Enterprise clients

**What it is for.** Set up a custom customer that does not pay through the pricing page.

**Flow.** An admin opens `/studio/admin/clients` and fills a form: name, owner email, base plan, and optional overrides (active-task limit, turnaround in seconds, a Stripe price ID). The API creates the workspace and an override record.

**Status:** **Partly built.** Create works (`pages/admin/AdminClientsPage.tsx`, `POST admin/workspaces`). Reading and changing an override has API routes (`GET` and `PATCH admin/workspaces/:id/override`) but no screen.

## Billing inspector

**What it is for.** Check a client's subscription and credits when something looks wrong.

**Flow.** The page shows, per workspace: subscription status, Stripe subscription ID, current period, active-slot limit, SLA hours, day credits and AI credits, whether the daily burn is allowed today and why not, and a raw debug payload. A table lists all workspaces with credit use. An admin can trigger the daily burn by hand.

**Status:** **Built** (`pages/BillingPage.tsx`, `services/api/src/stripe/stripe.controller.ts` debug route, `services/api/src/credits`). The route flag is `studioBillingInspector`, on.

## Calendar

**What it is for.** See when tasks arrived.

**Status:** **Partly built.** `/studio/calendar` is a month grid. It places each task on the day it was created, not on a due date (`components/AdminCalendar.tsx`). Strategy calls are not shown.

## Global search and notification bell

**Status:** **Built.** Search covers tasks and workspaces across all clients (`components/GlobalSearch.tsx`, search route with studio scope). The bell shows in-app notifications (`components/NotificationBell.tsx`).

## Notifications for the team

**What it is for.** Tell the team about high-signal events.

**Flow.** The API can post to an internal Slack channel. The channel is set by an environment variable (a webhook, or a bot token with a channel). It posts when a task is created, started, completed, or has a revision request, and for new workspaces and billing events (payment failed, plan paused, plan resumed, plan cancelled). Each message links to the task in Studio when it can.

**Status:** **Partly built** (`services/api/src/common/notifications/notification.service.ts`). Nothing is sent unless you set the Slack variables. Two hourly checks exist (see `platform-and-data.md`): a warning when a task is within 6 hours of its deadline, and an escalation flag when it is late. The spec asked for a "stuck for 24 to 36 hours" alert and a "credits depleted" alert. Neither exists.

## Settings

**Status:** **Built** (`pages/SettingsPage.tsx`). Profile (name from Clerk), notification preferences (email, Slack, in-app), and an integrations list. Slack shows "Configured per workspace". Linear and Figma show "Coming soon".

## AI readiness page

**What it is for.** See how well clients write briefs and how good the estimator is.

**Flow.** The page shows the share of tasks with a structured brief, the average revision count over 30 days, the estimator's average error in hours, a count by asset type, and a table of recent estimates against actual hours.

**Status:** **Partly built** (`pages/app/StudioAiInsightsPage.tsx`, API `studio/ai/tasks-summary` and `studio/ai/recent-estimates`). The page and API exist. Known issue: the cards render empty in a fresh install. They fill only after clients submit tasks with structured briefs and tasks complete.

## Pods and teams

**What it is for (spec).** Named delivery teams, a team dashboard, a task pool, one team per user.

**Status:** **Planned, not built.** `/studio/pods` shows a placeholder. The menu label reads "Pods (coming soon)". There is no team table in the schema. This is a known issue.

## Not built

These items from the original admin spec have no code:

- Global queue filters by team, and a separate flagged-tasks tab.
- Activity log screen and its filters. The API stores a lifecycle event for each status change (`task_lifecycle_events`), but no screen shows it.
- Internal notes on a task.
- Teams, team pools, task claiming, "my tasks" for designers.
- Revisions panel with priority sorting.
- AI credit panel and manual credit override.
- Sales CRM in Studio. See `sales-and-crm.md`.
- Strategy-call scheduling view and call notes.
- Email or webhook alerts for "task stuck" and "credits depleted".
