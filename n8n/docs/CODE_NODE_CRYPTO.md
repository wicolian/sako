# Code Node: Crypto Module Restriction (n8n 2.6+)

In n8n 2.6+, the Code node runs in a sandboxed task runner. The Node.js built-in module **`crypto` is disallowed** by default. If your workflow uses `require('crypto')`, you will see:

```text
Error: Module 'crypto' is disallowed
```

---

## Option 1: Use the Repo Workflows (Recommended)

Shared workflows in this repo **do not use `crypto`**:

- **Webhook Auth (Shared)** – Performs **payload structure validation** only (no HMAC verification). Re-import `workflows/_shared/webhook-auth.json` to get the current version.
- **Slack** (command handler, app home, approval handler) – Use timestamp freshness + payload validation only.

Re-import the workflow from the repo so the Code node no longer references `crypto`.

---

## Option 2: Allow `crypto` (Self-Hosted Only)

If you need real HMAC/signature verification inside a Code node (e.g. custom webhook crypto), you can allow the built-in `crypto` module.

Set this in the **same environment where the Code node runs**:

- **Single-process (e.g. Railway, no task runners):**  
  `NODE_FUNCTION_ALLOW_BUILTIN=crypto`
- **With Task Runners:** set the variable on the **task runner** processes, not only on the main n8n process.

Example (Railway / env file):

```bash
NODE_FUNCTION_ALLOW_BUILTIN=crypto
```

To allow all built-in modules (less secure): `NODE_FUNCTION_ALLOW_BUILTIN=*`

After changing env, restart n8n (and task runners if used).

---

## Summary

| Approach              | Pros                          | Cons                                  |
|----------------------|-------------------------------|----------------------------------------|
| Repo workflows (no crypto) | No config, works in sandbox   | No HMAC verification, rely on structure + URL obscurity |
| `NODE_FUNCTION_ALLOW_BUILTIN=crypto` | Full crypto in Code node      | Requires env change and restart        |

For webhook auth, this project uses **payload validation + timestamp checks** where applicable; re-import the shared workflows to avoid the `crypto` error.
