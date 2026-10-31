# Product and service: what we sold and how delivery worked

What the business actually sold, how a request moved from brief to delivery, and the software we built around it. Use it to design a productized service of your own.

## How to use this

- Read sections 1 to 4 if you are deciding what to sell and how to run delivery.
- Read sections 5 to 8 if you plan to build the software. We built it ourselves with AI agents.
- Section 9 holds the bigger idea we pitched (software for any productized service). Treat it as an idea, not a finished product.

## 1. What we sold

A design and motion subscription for B2B SaaS growth teams. Clients send requests through a dashboard. A small team ships production-ready assets in 48 business hours. Month-to-month billing. No contracts.

The promise in one line:

> We are a design pod for B2B SaaS growth teams. We clear the design backlog so growth teams ship faster, without hiring, freelancer chaos, or agency lock-in.

Who it was for:

- B2B SaaS companies with an active growth motion
- Marketing teams that ship assets often
- Product marketing teams that launch features often
- Revenue teams that need sales or pitch decks

Who it was not for:

- One-off logo work
- Deep product UX roadmaps
- Long brand strategy projects (only on Enterprise)

## 2. What was covered

**Design:** landing pages, decks, social graphics, ad creative, email design, UI work for marketing, builds in a no-code site tool from approved designs.

**Motion:** reels, explainers, motion graphics, transitions, kinetic type, captions, video editing and cutdowns.

**Strategy (Enterprise only):** strategy calls on request, creative direction.

**Not covered:** heavy 3D or VFX, character animation, full product UX research, engineering, complex CMS builds, migrations, multi-language work, memberships or login features, print design, long-form video (20 minutes or more).

Write this list for your own service before you sell. A clear "no" list is a margin tool.

## 3. How a request moved through delivery

1. **Submit.** The client fills in one intake form: title, description, category (design or motion), brand (optional), reference links and files (optional).
2. **Queued.** The task waits for a free slot.
3. **In progress.** The team picks it up. The 48-hour clock starts when work begins. A day credit is used for each working day.
4. **In review.** The team delivers. The client reviews.
5. **Completed or revision.** The client approves, or requests changes. A revision moves the task back to "in progress" and counts as a revision.
6. **Paused** (rare). Manual pause of a task.

The task states we used: Queued, In progress, In review, Completed, Paused.

### Rules that kept delivery predictable

- Only the active slots are worked on. The rest wait in the queue.
- The client can reorder the queue by dragging tasks.
- Every active task has a visible countdown. If we miss, the client gets a service credit.
- Revisions are unlimited "until the brief is matched", and each revision is treated like a new 48-hour task.
- Clients get updates in chat (task active, task delivered, designer question). The dashboard is the source of truth.

### Onboarding (about 48 hours)

- [ ] Collect the brand kit: logos, colors, fonts, tone, examples of good and bad.
- [ ] Set up the client's dashboard and team seats.
- [ ] Connect the chat tool.
- [ ] The client submits the first task.

After three or four tasks, the team knows the brand about as well as an in-house designer.

## 4. Team and roles

On the delivery side we used these roles:

| Role | Does |
|---|---|
| Designers | Pick up and deliver design tasks |
| Motion artists | Pick up and deliver motion tasks |
| Operators | Manage capacity and client relationships |
| Admins | Full access, billing, approvals |

In practice one founder ran a team of four designers. The other founder handled product and growth, with one HR person and one growth specialist, and built the software. Our planning documents described bigger "pods" (see `pricing-and-unit-economics.md`). That is a model, not what we ran.

Client-side workspace roles:

| Role | Can |
|---|---|
| Owner | Everything, including billing and members |
| Submitter | Create and manage their own tasks |
| Member | View tasks and add comments |
| Viewer | Read only |

## 5. The software: three apps and one API

We built a small set of apps that share one login.

| App | For | What it does |
|---|---|---|
| Marketing site | Visitors | Explains the offer and starts sign-up |
| Client app | Clients | Dashboard, tasks, brands, team settings, billing |
| Studio app | Our team | All clients, all tasks, a board, capacity, delivery |
| AI composer | Clients (optional) | First-draft landing pages, decks and social posts |
| API | All apps | Tasks, billing, credits, brands |

Shared login across all apps through a hosted auth service. A user signed into one is signed into all.

### Client app

- Dashboard: plan, day credits, AI credits, active tasks, tasks waiting for review, quick actions.
- Tasks: submit, track, review.
- Brands: color, type and voice profiles that the team reads on every task.
- Settings: profile, team members, billing, notifications.

### Studio app (internal)

- Dashboard: metrics across clients, at-risk tasks, capacity.
- Clients: every workspace, plan status, credits.
- Tasks: all tasks across all clients.
- Board: drag-and-drop task management.
- Actions: pick up (queued to in progress, day credit burn starts), submit for review, and handle revisions.

### Two ways for a client to start work

| Path A: AI draft first | Path B: direct brief |
|---|---|
| The client generates a first draft in the AI composer, refines it, then either downloads it or sends it to the team for polish | The client writes a brief and the team creates from scratch |
| More effort for the client | Less effort for the client |
| The team polishes and finishes | The team does full creation |
| Good for landing pages, decks and social posts | Good for motion, complex design, and busy clients |

Both paths use day credits when the team works. Motion always used path B, because the AI composer did not do motion in version 1.

### What we learned about the composer idea

It was a way to give clients something instant and to save team time on first drafts. Whether it saved time in practice was not measured here. Treat it as a hypothesis to test.

## 6. Internal AI tools we described

Live when we wrote the documents:

- **Task estimator:** predicts turnaround time.
- **SLA watchdog:** watches workload and capacity against the clock.
- **Feedback parser:** turns client comments into a clear list of changes.
- **Delivery assistant:** handles file handoff.

Planned:

- **Revision predictor:** anticipates change requests.
- **Sentiment monitor:** tracks client satisfaction.
- **Load balancer:** optimizes who works on what.
- **AI project manager:** automates coordination.

## 7. Credits, in plain words

- **Day credit:** one working day of the delivery team. Used when we work on your task.
- **Active slot:** one job in progress. Plans have 1, 2 or 3 or more.
- **AI credit:** one AI-generated draft in the composer. Does not pay for human work.
- **Pause:** day credits stop being used. Unused days stay in the bank.

Prices are in `pricing-and-unit-economics.md`.

## 8. Metrics to track (targets we set)

- SLA hit rate: 95% or more inside 48 hours.
- Revision cycles per task: fewer than 2 on average.
- Tasks per client per month: 8 to 12 on the middle plan.
- Monthly churn: under 5%.
- Upgrade rate across plans.

## 9. The bigger idea: an operating system for productized services

Alongside the design business, we wrote a pitch for turning the same system into a product other people could use to run their own productized service. The idea:

- A service provider describes what they sell.
- The system generates pricing and plans, limits and rules, SLA timers, intake forms, templates, a checkout, and capacity settings.
- Once clients subscribe, work runs through one loop: sell, intake, deliver, bill, measure, improve.

The five parts we said made it different:

1. **AI estimator:** predicts effort, cost and turnaround from real delivery data.
2. **SLA engine:** a countdown and a breach alert on every task.
3. **Capacity control:** you set how many active tasks a client may run.
4. **Chat-native workflows:** clients do not need a login. Requests flow from chat to a board, timers, delivery and billing.
5. **Everything linked:** pricing, delivery, SLAs and estimates feed each other.

The problem it aimed at: service businesses want recurring revenue and buyers want predictable results, but both sides run on a mix of docs, chat, billing tools, spreadsheets and automations. There is no single place to design, sell, deliver and improve one productized service.

Roadmap ideas in the plan: a public software launch, a marketplace for services built on the system, and optional overflow capacity from partner teams. None of these were completed before we closed.

## 10. Adapt it

- Decide your unit: slots, outputs or seats. Build the dashboard around it.
- Copy the five task states. They are enough.
- Start with a form and a board. You can run the first clients on simple tools while you learn what the software must do.
- Add one internal tool at a time, driven by what hurts most (for us it was SLA clocks and capacity).
- Write the "not included" list on day one.
- If you build with AI agents, keep one person owning the product. It worked for us, and the software was never the bottleneck. Distribution was.
