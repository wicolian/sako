# Sako product docs

These docs describe what Sako does. Sako was a design subscription for B2B SaaS teams, started by Sanjay and Koushik. It sold one monthly fee, a queue of design requests, and a 48-hour delivery time for each active slot.

The company wrote product specs (PRDs) before it built the software: a client side spec, an admin side spec, a full platform spec with a data model, and a sales spec. The software then changed during the build. These docs start from those specs and are corrected to match the open-source code in this repo today.

When a spec and the code disagree, the code wins. Each feature has a Status line:

- **Built**: the code exists. The file or route is named.
- **Partly built**: some of it exists. The text says what is missing.
- **Planned, not built**: the spec asked for it and there is no code.

## The docs

| Doc | What it covers | Original source |
|---|---|---|
| [client-portal.md](client-portal.md) | The customer app: sign-up, tasks, review and approval, brands, calendar, settings, billing, Slack | Client dashboard PRD |
| [studio.md](studio.md) | The design team app: queue, task workspace, clients, billing inspector, user admin | Admin dashboard PRD |
| [platform-and-data.md](platform-and-data.md) | The API, plans, the data model, the task lifecycle, the SLA clock, day credits, and the Composer app | Full platform spec |
| [sales-and-crm.md](sales-and-crm.md) | Lead filters, the n8n lead workflows, the nurture emails, and the CRM that was not built | Sales PRD and the CRM part of the admin spec |

Where the apps live:

| App | Folder |
|---|---|
| Client portal | `platform/apps/client` |
| Studio | `platform/apps/studio` |
| API | `platform/services/api` |
| Composer (GTM app) | `apps/gtm` |
| Lead workflows | `n8n/workflows/leads` |

For the business side (pricing logic, sales playbook, pitch), see `docs/playbooks`. These product docs do not repeat it.

## Known gaps

These are filed as issues and the docs treat them as part of the current state:

- The client pricing page needs your own Stripe pricing table.
- The Studio AI page shows empty cards until there is data.
- The Studio Pods page is a placeholder.
- Some Composer (GTM app) routes return 404.

## How the specs changed in the build

These are the biggest differences between the plans and the code.

1. **Day credits count days, not task work.** The specs said a day credit is used when the pod works on a task, so two tasks in one day use two credits. In the code, the system burns exactly 1 credit per day for each workspace, by a daily job. It does this even when no task is open. It stops only when the plan is paused. No screen or rule blocks a task when credits run out. See `platform-and-data.md`.

2. **Tasks are flat. Teams, assignment and subtasks were not built.** The specs described a master task with subtasks, named design teams, a team task pool, direct assignment, a "my tasks" view for designers, and a role that sees only assigned work. The code has one flat task table. Every Studio admin sees every task. The assignment panel in the task page is a fixed label, and the priority buttons do nothing. The Pods page is a placeholder.

3. **The CRM and the Sales role were not built.** The admin spec had a CRM board with Cold, Warm, Hot and Converted columns, follow-up reminders and email templates. Studio has none of this. Sales work moved to 14 n8n workflows that keep data in Google Sheets and use an AI score for the ideal customer profile. The PRD said to avoid companies that hire designers. The hiring monitor looks for them, as a buying signal. The free redesign program has no code. The API has a small marketing module that sends a 5-email series to people who view the pricing page. See `sales-and-crm.md`.

4. **Plans and pricing changed.** The specs had a Core Design plan and a Core Motion plan. The code has one Core plan with both. Enterprise starts at $8,500 a month in code, and the sales spec said $10,500. AI credits in the specs were 50, 75 and 100 or more a month. In the code, Studio plans have unlimited AI credits. Two new plans, Composer Free and Composer Pro, are limited to AI use. Seats are 2, 4 and 5, not 2, 5 and unlimited. See `platform-and-data.md`.

5. **The stack and the access rules changed.** The specs planned Supabase with row-level security, Supabase Auth, SvelteKit or Next.js, and Zapier alerts. The code uses a NestJS API with Postgres and Prisma, Clerk for sign-in, React and Vite for the portal and Studio, and built-in notifications. Access is checked in API guards, not in the database. The workspace roles (owner, submitter, member, viewer) are enforced mostly in the screens, not in the API. The studio roles shrank to `ADMIN` plus a super admin flag.

More changes worth knowing:

- **Composer grew into its own product.** The spec described a small tool for landing pages, decks and social posts. The GTM app (`apps/gtm`) is a large AI marketing workspace on Supabase with its own sign-in. Its link back to the platform API calls routes that do not exist, so "Send to Sako" from the GTM app looks unfinished. The platform API has the routes an outside Composer app would call.
- **A review board was built that the specs did not describe.** It shows deliverables with versions, pinned and timed comments, threads, and approve or request-changes. It works for images, PDF, video, Figma, Lottie and Rive.
- **The SLA clock got rules the specs did not have.** It stops while the client reviews and while the plan is paused. A late task gives the client 1 day credit back. Warnings go out 6 hours before a deadline, and late tasks are marked as escalated.
- **Slack went further than planned.** It has slash commands to create a task and read status. Microsoft Teams was not built.
- **Many client features were never built.** These are CSV import, task templates, the uploads page and the 2 GB limit, the docs page, the credits page, the analytics page, strategy call tracking, and per-task visibility. The attachment limit is 50 MB, and a review version can be 100 MB.
- **The Studio dashboard hides sample data.** Panels for calls, pods and invoices use made-up numbers. Flags keep them off.
- **A few Studio buttons call missing routes.** "Mark Completed" and "Duplicate" on the Studio task page call admin routes that the API does not have.
