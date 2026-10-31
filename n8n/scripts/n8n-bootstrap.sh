#!/bin/sh
set -e

echo "[bootstrap] Starting n8n..."
/usr/local/bin/n8n start &
N8N_PID=$!

(
  MARKER="/home/node/.n8n/.workflows_imported"

  if [ -f "$MARKER" ]; then
    echo "[bootstrap] Import marker exists; skipping workflow import."
    exit 0
  fi

  echo "[bootstrap] Importing workflows (recursive)..."
  tries=20
  while [ $tries -gt 0 ]; do
    if /usr/local/bin/node /home/node/import-workflows.mjs; then
      touch "$MARKER" || true
      echo "[bootstrap] Workflow import complete."
      exit 0
    fi
    tries=$((tries - 1))
    echo "[bootstrap] Import failed (likely DB not ready). Retrying in 3s..."
    sleep 3
  done

  echo "[bootstrap] Workflow import gave up after retries (n8n will still run)."
) &

wait $N8N_PID
