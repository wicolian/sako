# n8n workflow publish order

Publish workflows in this order so every referenced sub-workflow is already published. If a workflow is already published, skip it and continue.

**Push to production (no duplicates):** Run `node scripts/sync-workflows.mjs` with `N8N_BASE_URL` and `N8N_API_KEY` set. It upserts by name (update if exists, create if not). See README → “Sync workflows to production”.

**Why this order:**  
- `error-handler` is referenced by many workflows in **Settings → Error Workflow**.  
- `apify-runner` is called by several workflows via **Execute Workflow** nodes.  
- `utm-link-generator` is called by **Slack Approval Handler**.  

The shared workflow JSONs (`error-handler`, `apify-runner`, `webhook-auth`, `utm-link-generator`) include a stable root **id**. Import them in the order below so n8n can use those ids and “Execute Workflow” / “Error Workflow” references resolve.

---

## Publish in this order

| # | Workflow (publish this) | References | File |
|---|--------------------------|------------|------|
| 1 | **Error Handler (Shared)** | — | `_shared/error-handler.json` |
| 2 | **Apify Runner** | — | `_shared/apify-runner.json` |
| 3 | **Webhook Auth (Shared)** | — | `_shared/webhook-auth.json` |
| 4 | **UTM Link Generator** | error-handler | `content/utm-link-generator.json` |
| 5 | **Slack Approval Handler** | utm-link-generator, error-handler | `content/slack-approval-handler.json` |
| 6 | Content Performance Tracker | error-handler | `content/content-performance.json` |
| 7 | Claims Safety Checker | error-handler | `content/claims-safety-checker.json` |
| 8 | Content Generator | error-handler | `content/content-generator.json` |
| 9 | Trends Social Poster | apify-runner | `content/trends-social-poster.json` |
| 10 | LinkedIn Agent | — | `content/linkedin-agent.json` |
| 11 | Video Avatar Publisher | — | `content/video-avatar-publisher.json` |
| 12 | Competitor Content Change Monitor | apify-runner, error-handler | `infra/competitor-content-monitor.json` |
| 13 | Backup Workflows | error-handler | `infra/backup-workflows.json` |
| 14 | Metrics Reporter | error-handler | `infra/metrics-reporter.json` |
| 15 | Lead Intake Router | apify-runner, error-handler | `leads/lead-intake-router.json` |
| 16 | Company Enrichment from Website + Apollo | error-handler | `leads/company-enrichment.json` |
| 17 | LinkedIn Contact Discovery (Sales) | apify-runner | `leads/linkedin-contact-discovery.json` |
| 18 | LinkedIn Profile Enricher (Qualified Leads) | apify-runner, error-handler | `leads/linkedin-profile-enricher.json` |
| 19 | LinkedIn Hiring Signal Monitor | apify-runner, error-handler | `leads/linkedin-hiring-signal-monitor.json` |
| 20 | LinkedIn InMail Generator (Sales) | error-handler | `leads/linkedin-inmail-generator.json` |
| 21 | LinkedIn InMail Approval | error-handler | `leads/linkedin-inmail-approval.json` |
| 22 | Apollo ICP Qualifier | — | `leads/apollo-icp-qualifier.json` |
| 23 | Brevo Warm Opens | — | `leads/brevo-warm-opens.json` |
| 24 | Cal.com Booking Handler | error-handler | `leads/calcom-booking-handler.json` |
| 25 | Call Prep Brief | error-handler | `leads/call-prep-brief.json` |
| 26 | Handle Email Events | error-handler | `leads/handle-email-events.json` |
| 27 | Mark Called Handler | — | `leads/mark-called-handler.json` |
| 28 | Quo Call Logger | — | `leads/quo-call-logger.json` |
| 29 | Earned Media Outreach | apify-runner, error-handler | `pr/earned-media-outreach.json` |
| 30 | PR Hook Generator | apify-runner, error-handler | `pr/pr-hook-generator.json` |
| 31 | Reddit Signal Monitor | apify-runner, error-handler | `pr/reddit-monitor.json` |
| 32 | Coverage Tracker | apify-runner, error-handler | `pr/coverage-tracker.json` |
| 33 | Media Target Discovery | apify-runner, error-handler | `pr/media-target-discovery.json` |
| 34 | Journalist Monitor | error-handler | `pr/journalist-monitor.json` |
| 35 | Media Kit Generator | error-handler | `pr/media-kit-generator.json` |
| 36 | Newsroom Publisher | error-handler | `pr/newsroom-publisher.json` |
| 37 | Designer Sourcing | apify-runner | `recruiting/designer-sourcing.json` |
| 38 | Designer Screening (AI) | error-handler | `recruiting/designer-screening.json` |
| 39 | Designer Outreach Drafts (Recruiter) | error-handler | `recruiting/designer-outreach.json` |
| 40 | Slack Command Handler | error-handler | `_shared/slack-command-handler.json` |
| 41 | Slack App Home | error-handler | `_shared/slack-app-home.json` |
| 42 | Morning Briefing | error-handler | `analytics/morning-briefing.json` |
| 43 | EOD Summary | error-handler | `analytics/eod-summary.json` |
| 44 | Weekly Growth Report | error-handler | `analytics/weekly-growth-report.json` |

---

## Short checklist (minimum order)

If you only care about avoiding “references workflow which is not published”:

1. **Error Handler (Shared)** — `error-handler`
2. **Apify Runner** — `apify-runner`
3. **UTM Link Generator** — `utm-link-generator`
4. **Slack Approval Handler** — `slack-approval-handler`
5. All other workflows in any order.

---

## "Cannot publish: Node … references workflow X which is not published"

In **n8n 2.x**, being active or saved is not enough for a **sub-workflow** to be callable. The referenced workflow must be **published** (the **Publish** button in the editor).

**Fix:**

1. Open the **referenced** workflow (e.g. **UTM Link Generator**).
2. Click **Publish** (top right). Wait until it shows "Published (up to date)" or similar.
3. Then open the **parent** workflow (e.g. **Slack Approval Handler**) and click **Publish**.

**Note:** The sync script’s `N8N_ACTIVATE_DEPS=1` only **activates** workflows via the API. In n8n 2.x that is **not** the same as **Publish**. You must still open **UTM Link Generator** in the editor and click **Publish** (top right), then **Publish** Slack Approval Handler. Activate just turns the workflow on; Publish creates the version that sub-workflow references require.

**UTM is already published but you still get the error:** The "Trigger UTM Generator" node was pointing at the id `"utm-link-generator"` (a repo slug). On the server the UTM workflow has a different n8n id (see its URL). Re-bind: open **Slack Approval Handler** → **Trigger UTM Generator** node → set **Source** to **From list** → select **UTM Link Generator** from the dropdown → **Save** → **Publish**. The repo workflow was updated to use "From list"; after the next sync you only need to pick UTM once.

---

## If you see “Workflow does not exist” or “Workflow ID: [object Object]”

The Execute Workflow node is pointing at a workflow id that doesn’t exist in your instance (e.g. after import n8n gave workflows new ids). Fix it like this:

1. **Re-bind the sub-workflow (recommended)**  
   - Open the workflow that’s failing (e.g. **LinkedIn Contact Discovery**).  
   - Open the **Execute Workflow** node (e.g. “Apify: LinkedIn Leads Generator”).  
   - Set **Source** to **From list**.  
   - In the workflow dropdown, select the correct sub-workflow (e.g. **apify-runner** or **Apify Runner**).  
   - Save the workflow.

2. **If the node says “This node is out of date. Please upgrade…”**  
   - Delete the existing Execute Workflow node.  
   - Add a new **Execute Sub-workflow** node from the node list.  
   - Set **Source** to **From list** and select the sub-workflow (e.g. **apify-runner**).  
   - Re-enter the same **Workflow Inputs** as before, reconnect the node, then save.

3. **Error Workflow in Settings**  
   - Open the workflow → **Settings** (gear) → **Error Workflow**.  
   - Re-select **Error Handler (Shared)** from the list if it’s missing or wrong, then save.

After re-binding, run the workflow again; “Workflow does not exist” should be gone.

---

## Finding workflows in n8n

- **By name:** Use the “Workflow name” in the table (e.g. “Error Handler (Shared)”).
- **By id:** After import, the URL is `/workflow/<id>`. The repo uses stable ids for shared workflows (`error-handler`, `apify-runner`, `webhook-auth`, `utm-link-generator`). If your instance assigns different ids on import, use the re-bind steps above so Execute Workflow and Error Workflow point at the right workflow.
