#!/bin/sh
set -e

# Start Caddy (injects Origin header for n8n push endpoint)
caddy start --config /etc/caddy/Caddyfile --adapter caddyfile

# n8n on 5680, Caddy on 5678, Task Broker gets 5679 (default)
export N8N_PORT=5680
exec n8n start
