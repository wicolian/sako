# Security

Sako is maintained by the author. Still, do your own security review before you run it with real
customers or real money.

## Reporting a problem

Please do not open a public issue for a security problem. Use GitHub's private reporting instead:
**Security → Report a vulnerability** on this repo. I aim to reply within a week. Commercial licensees get priority.

## What is already in place

- Secret scanning and push protection on this repo, plus a gitleaks check on every pull request.
- Dependabot security updates, and weekly minor and patch updates.
- All images run on Node 22 (LTS).

## Before you go live

- Use your own keys for everything in `.env`. Never reuse example values.
- Set strong `POSTGRES_PASSWORD`, `N8N_ENCRYPTION_KEY`, `SESSION_SECRET` and `WALL_PASSWORD` (the installer makes random ones).
- Do not expose Postgres to the internet. The Terraform setups do this by default; lock them down.
- Serve n8n over HTTPS and set `N8N_SECURE_COOKIE=true`.
- Check the open [issues](https://github.com/wicolian/sako/issues) labelled `known issue`.
