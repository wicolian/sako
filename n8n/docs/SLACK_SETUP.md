# Slack Setup – Event Subscriptions & URL verification

Use this when configuring your Slack app so that **Event Subscriptions** (and App Home) work with n8n.

---

## 1. Correct Request URL

Use this **exact** URL (no `/home/` in the path):

```
https://n8n.sako.agency/webhook/slack-events
```

- **Wrong:** `https://n8n.sako.agency/home/webhook/slack-events`
- **Right:** `https://n8n.sako.agency/webhook/slack-events`

---

## 2. Before saving the URL in Slack

1. **Import and activate the workflow**  
   In n8n, import `workflows/_shared/slack-app-home.json` and turn it **Active** (toggle on).
2. **Set env**  
   Ensure `SLACK_SIGNING_SECRET` is set in Railway (or your `.env`). Get it from Slack: **App → Basic Information → App Credentials → Signing Secret**.
3. **Save the Request URL in Slack**  
   In your Slack app: **Event Subscriptions** → **Enable Events** → **Request URL** → paste `https://n8n.sako.agency/webhook/slack-events` → **Save**.

Slack will send a one-time `url_verification` request. The workflow responds with the challenge so Slack marks the URL as verified.

---

## 3. If you see "Your request URL didn't respond with the correct challenge value"

- Confirm the **Slack App Home** workflow is **Active** in n8n.
- Confirm the URL has **no** `/home/` (use `/webhook/slack-events`).
- Confirm `SLACK_SIGNING_SECRET` is set (required for real events; the challenge is handled before verification).
- Re-save the Request URL in Slack to trigger a new challenge.

---

## 4. Subscribed events

For App Home to work, subscribe to:

| Event        | Description                    |
|-------------|--------------------------------|
| `app_home_opened` | User opened your App Home |

Add more events under **Subscribe to bot events** as needed.

---

## 5. Other Slack URLs (for reference)

| Feature           | URL |
|-------------------|-----|
| Event Subscriptions | `https://n8n.sako.agency/webhook/slack-events` |
| Interactivity & Shortcuts | `https://n8n.sako.agency/webhook/slack-action` |
| Slash commands    | `https://n8n.sako.agency/webhook/slack-command` |

Replace `n8n.sako.agency` with your n8n host if different.

---

## 6. Restricting n8n messages to only 3 channels

If you want **only three channels** to receive n8n messages (e.g. `#lead-and-growth`, `#n8n-ops`, `#pr-signals`):

1. **Create or pick the 3 channels** in Slack and add the **Sako Automates** app to each (so it can post).
2. **Replace channel names** in the repo workflows with your three. The workflows use hardcoded `channel` values when posting to Slack. Change them to one of your three as appropriate:
   - **Errors / alerts:** `workflows/_shared/error-handler.json` — `#n8n-errors` and `#sako-alerts` → e.g. `#n8n-ops`.
   - **Leads / growth:** Many workflows use `#sako-leads` or `#sako-growth` — e.g. set to `#lead-and-growth`.
   - **PR / signals:** PR workflows use `#pr-coverage`, `#pr-ideas`, `#pr-requests`, `#signals` — e.g. set to `#pr-signals`.
3. **Sync after editing:** After changing the JSON files, run `node scripts/sync-workflows.mjs` (with `N8N_BASE_URL` and `N8N_API_KEY`) so production n8n gets the updated workflows.

To make channel names configurable per environment (e.g. one channel for errors, one for leads, one for PR), you could later introduce env vars (e.g. `SLACK_CHANNEL_ALERTS`, `SLACK_CHANNEL_LEADS`, `SLACK_CHANNEL_PR`) and use expressions like `{{ $env.SLACK_CHANNEL_ALERTS }}` in the HTTP Request nodes that call `chat.postMessage`. For a fixed set of three channels, editing the JSON and syncing is enough.
