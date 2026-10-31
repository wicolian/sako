# n8n Troubleshooting — n8n.sako.agency

## "Customize n8n to you" / Owner setup on every refresh

This screen appears because n8n cannot find a valid owner account in the database. The three most common causes:

### Cause 1: `N8N_ENCRYPTION_KEY` not set or changes between deploys

Railway has an **ephemeral filesystem**. If `N8N_ENCRYPTION_KEY` is not set as a Railway env var, n8n auto-generates one and saves it to `~/.n8n/config` — which is wiped on every deploy. When the key changes, n8n can't decrypt any stored data (users, credentials), so it thinks it's a fresh install.

**Fix:**

1. Generate a key: `openssl rand -hex 32`
2. In **Railway → n8n service → Variables**, set `N8N_ENCRYPTION_KEY` to that value.
3. **Never change this key** after setting it.
4. Redeploy.

### Cause 2: Owner account was never properly created

On first launch, n8n shows an owner setup screen (name, email, password). If this wasn't completed, or if the DB was wiped/reset, there's no owner.

**Fix:**

1. Make sure your Neon Postgres is connected and reachable.
2. Open `https://n8n.sako.agency` — complete the owner setup form.
3. This creates the owner account in Postgres. All subsequent visits will require login.

### Cause 3: Personalization survey (separate from owner setup)

If you've already set up the owner account but still see "What best describes your company?" questions, that's the personalization survey.

**Fix:** Set in Railway:

```bash
N8N_PERSONALIZATION_ENABLED=false
```

This is already set in the Dockerfile, but Railway env vars may override it. Set it explicitly in Railway Variables to be safe.

---

## No login required (incognito or new browser)

**`N8N_BASIC_AUTH_ACTIVE` was removed in n8n 1.0.** It does nothing. Don't use it.

n8n uses **built-in User Management** since 1.0:

1. On first launch, n8n shows an **owner setup screen** (name, email, password).
2. Complete it — this creates the owner account stored in Postgres.
3. All subsequent visits (including incognito) require that email + password.

If you can access the editor without login, it means the owner account doesn't exist (see the section above about encryption key / DB issues).

**Fix:**

1. Ensure `N8N_ENCRYPTION_KEY` is set and persistent in Railway (see above).
2. If the DB has corrupt/orphaned user data, you may need to reset:
   - Connect to your Neon Postgres
   - Run: `DELETE FROM "user";` (this wipes all n8n user accounts)
   - Redeploy — n8n will show the owner setup screen again
   - Complete the setup with your email + password
3. Done. Every visit now requires authentication.

See: https://docs.n8n.io/hosting/configuration/user-management-self-hosted/

---

## GET /rest/push 500 (Internal Server Error)

The `/rest/push` endpoint handles real-time updates (SSE). A 500 usually means:

- **Broken user session** — if the owner account is in a bad state (see above), sessions can't validate.
- **Missing `N8N_PUSH_BACKEND=sse`** — Railway strips WebSocket `Origin` headers; SSE is required.

**Fix:**

1. Fix the owner account / encryption key issue first (see above).
2. Ensure these Railway env vars are set:
   ```bash
   N8N_PUSH_BACKEND=sse
   N8N_EDITOR_BASE_URL=https://n8n.sako.agency
   N8N_PROXY_HOPS=1
   ```
3. Redeploy and hard-refresh the browser (Ctrl+Shift+R / Cmd+Shift+R).

---

## GET /rest/external-secrets/secrets 404

This is normal. External secrets are an **Enterprise** feature. The community UI still calls this endpoint and gets 404. Safe to ignore — it doesn't affect workflows or credentials.

---

## "Connection lost" red banner

See [CONNECTION_LOST_FIX.md](./CONNECTION_LOST_FIX.md).

TL;DR: Set `N8N_PUSH_BACKEND=sse` in Railway and redeploy.

---

## "Create your first workflow" but workflows were imported (400 on save)

**Cause:** The browser is using an **old project ID** in the URL (e.g. `.../projects/Oy8NWH5MQHTjvcvV/workflows`). That project no longer exists; workflows are under your real Personal project.

**Fix:**

1. Open **https://n8n.sako.agency/home** (or **Overview**).
2. Click **Personal** (or the project that shows your workflows).
3. Create or edit workflows from there.
4. If the wrong project persists, clear site data:
   Chrome → DevTools → Application → Storage → "Clear site data".

---

## Slack: "redirect_uri did not match any configured URIs"

**Fix:**

1. Go to [Slack API Apps](https://api.slack.com/apps) → your app → **OAuth & Permissions**.
2. Under **Redirect URLs**, add exactly (no trailing slash):
   `https://n8n.sako.agency/rest/oauth2-credential/callback`
3. Save and retry the Slack OAuth flow in n8n.

---

## Credentials lost after redeploy

**Cause:** `N8N_ENCRYPTION_KEY` changed (or was never set). See the first section.

**Fix:** Set `N8N_ENCRYPTION_KEY` as a persistent Railway env var. If credentials were already encrypted with a different key, they're unrecoverable — you'll need to re-enter them.

---

## /sako slash command does nothing

Slack sends the slash command to `https://n8n.sako.agency/webhook/slack-command` and expects a response within **3 seconds**. If nothing appears in Slack, check the following.

### 1. Slack Command Handler workflow is **Active**

If the workflow is inactive, n8n does not register the webhook and Slack gets no (or 404) response.

**Fix:** In n8n, open **Slack Command Handler** and turn the **Active** toggle **ON**. Save if prompted.

### 2. Slash command Request URL in Slack matches

In [Slack API → your app → Slash Commands](https://api.slack.com/apps), the **Request URL** must be exactly:

```
https://n8n.sako.agency/webhook/slack-command
```

No trailing slash; protocol must match your n8n host.

### 3. Commands that call external services can time out

- **`/sako metrics`** — Calls n8n’s API; needs `N8N_API_KEY` (and optionally `N8N_API_BASE_URL` or `N8N_EDITOR_BASE_URL`) set in n8n’s environment. If the API call fails or is slow, Slack may get no response.
- **`/sako leads`**, **`/sako content`**, **`/sako pr`**, **`/sako signals`** — Read from Google Sheets. If credentials or Sheets are slow/failing, the branch can error before any **Respond to Webhook** node runs.

**Fix:** Set `N8N_API_KEY` in Railway (or n8n env) for metrics. For others, ensure Google Sheets credentials are valid and the workflow runs without errors (test each branch in n8n).

### 4. Test with `/sako help` first

`/sako help` does not call APIs or Sheets; it only builds a message and responds. If **help** works but other commands don’t, the issue is with that branch (credentials, timeout, or missing env). If **help** also does nothing, the workflow is likely inactive or the webhook URL is wrong (see 1 and 2).
