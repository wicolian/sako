#!/bin/sh
set -e

# First start: import every workflow in /workflows (mounted from n8n/workflows) once.
MARKER=/home/node/.n8n/.sako-workflows-imported
if [ -d /workflows ] && [ ! -f "$MARKER" ] && [ "${SAKO_IMPORT_WORKFLOWS:-true}" = "true" ]; then
  echo "[sako] importing workflows from /workflows ..."
  ok=0; fail=0
  for f in $(find /workflows -name '*.json' | sort); do
    if n8n import:workflow --input="$f" >/dev/null 2>&1; then ok=$((ok+1)); else fail=$((fail+1)); echo "[sako] could not import $f"; fi
  done
  echo "[sako] imported $ok workflows ($fail failed). Add your credentials in n8n before you activate them."
  mkdir -p "$(dirname "$MARKER")" && touch "$MARKER"
fi

# Start Caddy (injects Origin header for n8n push endpoint)
caddy start --config /etc/caddy/Caddyfile --adapter caddyfile

# n8n on 5680, Caddy on 5678, Task Broker gets 5679 (default)
export N8N_PORT=5680
exec n8n start
