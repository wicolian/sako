# Sales and CRM

Sako had two sales needs: find the right companies, and track them to a deal. The original plan was a short Sales PRD about lead filters, plus a CRM screen in the admin spec. The build went another way. There is no CRM screen. Lead work runs in n8n workflows, and a small marketing module in the API sends nurture emails.

Status words:
- **Built**: the code or workflow exists and I read it.
- **Partly built**: some of it exists.
- **Planned, not built**: the spec asked for it and I found nothing.

Where to look:
- n8n lead workflows: `n8n/workflows/leads` (14 files)
- Sheet templates for them: `n8n/templates`
- API marketing module: `platform/services/api/src/marketing`

## What the original plan said

### Two lead lists

The Sales PRD built two target lists in a lead database tool (Apollo).

| List | Goal | Size |
|---|---|---|
| Free redesign program | Trade a free redesign for a logo, a testimonial and a case study | 10 companies |
| Paid target list | Close real deals with founders who have money and need | 20 to 30 qualified leads, 5 to 8 real talks, 2 to 4 paid deals per month |

### Filters in the PRD

| Filter | Free redesign list | Paid list |
|---|---|---|
| Industry | B2B SaaS (dev tools, HR tech, finops, cyber security) and D2C performance brands (beauty, wellness, lifestyle) | The same, plus a second tier: fintech, health tech, ed tech, travel tech, HR and recruiting tech |
| Funding | Pre-seed, seed, Series A | Seed, Series A, Series B |
| Revenue (ARR) | 50k to 300k | 500k to 5M |
| Team size | 5 to 30 | 10 to 80 |
| Geography | Eight markets, including the US, UK, Canada, Germany, Singapore, India | A longer list of markets |
| Tech stack signals | Site builders and ad pixels (for example Webflow, WordPress, Google Ads, Meta Pixel) | A similar list plus support and analytics tools |
| Hiring signal | Hiring growth or marketing roles. Not hiring designers | Hiring product, growth or marketing. Not hiring designers |
| People to target | Founder, co-founder, CEO, COO, head of growth, head of marketing | The same, plus CPO and head of product |
| Manual check | Open the company's people list. If 2 or more designers work there, remove the company | If the company has a design team, skip it. Few or no designers means a perfect target |

### The sales workflow in the PRD

1. Apply the filters in the lead tool.
2. Pick 20 companies for the free list and 30 for the paid list.
3. Do the manual designer check.
4. Add the final targets to two lists: free redesign and paid prospects.
5. Reach out by direct message first, email second.
6. Track opens, reply rates and conversions.
7. Report the top 10 candidates each week.

The expected output for the free list was 10 collaborations, 10 testimonials, 10 case studies and 5 to 10 portfolio sites. The plan prices in the PRD were: Core Design $2,500 a month, Core Motion $2,500, Ops $4,500, Enterprise from $10,500. The built plans are in `platform-and-data.md`. Core is one plan for design and motion, and Enterprise starts at $8,500.

### The CRM in the admin spec

The admin spec asked for a Sales CRM in the admin app at `/admin/crm`:
- A board with columns Cold, Warm, Hot, Converted.
- Lead name, email, source and tags.
- Contact logs: last contacted date, notes, assigned salesperson.
- Saved email templates.
- Follow-up reminders per team member.
- A Sales role that sees only the CRM.

## What exists

### CRM screen and Sales role

**Status: Planned, not built.** Studio has no CRM route, no lead board, no follow-up reminders, and no Sales role (`studio.md`). The platform schema has no `crm_leads` or `crm_followups` table.

The closest things are the sheet-based tracking and the lead table in the marketing module below.

### n8n lead workflows

**Status: Built.** The 14 workflows in `n8n/workflows/leads` run on n8n. They keep their data in Google Sheets. You import them and set your own sheets and credentials. The sheet column layouts are in `n8n/templates` (for example `qualified_leads`, `disqualified_leads`, `apollo_import`, `hiring_signals`, `warm_opens`, `call_tracker`, `inmail_outreach`, `suppression_list`, `idempotency_log`). Import order is in `n8n/docs/PUBLISH_ORDER.md`.

| Workflow | What it does | How it starts |
|---|---|---|
| `apollo-icp-qualifier` | Reads contacts exported from the lead tool. An AI model scores each from 0 to 100 against Sako's ICP. A score of 70 or more is qualified. Saves to a qualified or a disqualified sheet. Posts a summary to Slack | Manual, or called by another workflow |
| `company-enrichment` | For each qualified lead, pulls company data and the website text. An AI model writes the pain points, the fit for a design subscription, and a recommended package. Updates the sheet | Manual, or called |
| `linkedin-contact-discovery` | Uses a scraper to find new leads from a search. Removes duplicates. Adds them to the import sheet | Manual, or called |
| `linkedin-profile-enricher` | Scrapes the person's and the company's profile for qualified leads. Updates the sheet | Manual, or called |
| `linkedin-hiring-signal-monitor` | Looks for design job posts in the last 7 days. Finds a contact on the company site. Saves the signal and adds a lead. Posts to Slack | Weekly |
| `linkedin-inmail-generator` | An AI model drafts a LinkedIn message for each eligible lead. Saves it as a draft | Manual, or called |
| `linkedin-inmail-approval` | Posts each draft to Slack. A person approves or rejects through a link. Updates the status | Daily, or manual, or a webhook |
| `brevo-warm-opens` | Reads email opens from the email tool. Keeps people who opened and were not called. Adds company data. An AI model writes a call opener. Posts the call list to Slack | Daily |
| `quo-call-logger` | Takes a call-finished event from the dialer. Logs the call outcome. A call of 3 minutes or more, or a voicemail, posts a Slack note. Updates the warm sheet | Dialer webhook |
| `mark-called-handler` | Marks a contact as called when someone follows a link in Slack | Webhook |
| `calcom-booking-handler` | A booking on the scheduling tool updates the warm sheet, logs the meeting, tells Slack, and starts the call prep brief | Booking webhook |
| `call-prep-brief` | Pulls person and company data. An AI model writes a one-page brief. Posts it to Slack | Webhook |
| `lead-intake-router` | Takes a booking from Cal.com or Calendly. Checks the signature. Skips duplicates and suppressed emails. Enriches the lead. Scores it. High-intent leads go to Slack. Sends the lead to the API `marketing/capture-lead` route | Booking webhook |
| `handle-email-events` | Takes bounces and complaints from the email tool. Adds the address to a suppression list and blocks it in the email tool. Tells Slack | Email webhook |

How the pieces join: lists come in from the lead tool, the scrapers and the hiring monitor. The qualifier and enricher score and describe them. Outreach goes by LinkedIn drafts (with approval in Slack) and by email. Opens turn into a warm call list. Calls and bookings are logged to sheets. Slack is the place where a person sees and acts.

What I did not find: a node that sends the LinkedIn message by itself. The workflows write the draft and the approval. A person sends it.

### Where the workflows differ from the PRD

| Topic | PRD | n8n workflows |
|---|---|---|
| Free redesign program | A separate list of 10 companies | **Planned, not built.** No workflow or sheet for it |
| Qualification | Apollo filters plus a manual people check | An AI score from 0 to 100, with 70 as the cut. No manual designer check |
| Team size | 5 to 30 (free), 10 to 80 (paid) | 20 to 500 employees |
| Industry | B2B SaaS and D2C brands. Second tier: fintech, health tech and others | B2B SaaS only. The scoring prompt disqualifies consumer companies, agencies, crypto, sales roles, over 1,000 employees, and health or finance companies with heavy compliance |
| Hiring signal | Prefer companies that are **not** hiring designers | The monitor looks for companies that **are** hiring designers, and treats it as a buying signal |
| Budget in the prompt | Not stated | The prompt says a buyer can approve $2.5k to $8.5k or more per month |
| Outreach order | Direct message first, email second | Both exist. LinkedIn drafts need Slack approval. Email opens drive the call list |
| Weekly top 10 report | Yes | **Planned, not built** as a report. Each workflow posts its own Slack summary |
| Tracking of opens, replies, conversions | Yes | Partly built. Opens and calls are logged. There is no reply or conversion report |

### Marketing module in the API

**What it is for.** Catch people who look at the pricing page and send them a short email series.

**Status: Built**, and off by default. It runs only when the environment variable `MARKETING_LEADS_ENABLED` is `true` (`platform/services/api/src/marketing`).

**Flow.**
1. A signed-in visitor opens the portal pricing page. The page sends a "capture lead" call with the email, name and source `pricing_page_view`. A lead row is made, with UTM fields when present.
2. The lead-intake workflow in n8n can send booked leads to the same route.
3. A daily job at 10:00 checks each lead that is not converted, not unsubscribed and not suppressed. It looks at leads up to 45 days old. It sends the next email in the series that is due and not sent yet.
4. The series is five emails:

| Step | Sent | Idea |
|---|---|---|
| D0 | Day of signup | "You were looking at Sako" |
| D1 | Day 1 or later | What teams ship in week 1 |
| D3 | Day 3 or later | A short "just ship" note |
| D5 | Day 5 or later | A promo code. The default is 10 percent off, valid for 5 days. It uses a Stripe coupon you set up. A link to `/redeem` in the portal opens checkout with the code |
| D10 | Day 10 or later | A last note that offers a 10 minute walkthrough |

5. The email jobs go through a Redis queue. A worker process sends them with Resend.
6. When the lead pays, the portal marks the lead as converted and the series stops.
7. Each email has an unsubscribe link. A public route handles it.

**Admin routes (super admin).** List leads, export the list as CSV, read or edit one lead (notes, suppression), mark a lead as converted, send a chosen step to a lead, and run the sequence by hand. There is no screen for these in Studio. Call them through the API.

**Fields kept on a lead:** email, name, source, signup date, last activity, converted flag and date, UTM source, medium, campaign, content and term, unsubscribed and suppressed flags, and free-text notes.

Differences from the spec: this is a lead nurture tool for self-serve buyers. It is not the sales CRM. It has no cold, warm, hot columns, no owner, no follow-up reminder, and no contact log.

### GTM app

The Composer app (`apps/gtm`) has a HubSpot connection and an affiliate area. These are not the sales pipeline from the PRD. I did not check them in detail. See `platform-and-data.md` for what the app is.

## Summary

| Spec item | Status |
|---|---|
| Two lead lists with filters | Partly built. One qualifier with an AI score. The free list and the manual designer check are not built |
| Outreach and tracking | Partly built in n8n workflows and sheets |
| Weekly top 10 report | Planned, not built |
| Admin CRM board | Planned, not built |
| Lead info, contact log, notes | Partly built. Sheets for contacts and calls. A lead table with notes in the API |
| Email templates | Partly built. Five fixed nurture emails in the API |
| Follow-up reminders | Planned, not built. Slack notes after a voicemail or good call exist |
| Sales role | Planned, not built |
| Booking to call prep | Built in n8n (`calcom-booking-handler`, `call-prep-brief`) |
| Bounce and complaint handling | Built in n8n (`handle-email-events`) |
