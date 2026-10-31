# n8n Marketing Automations - Production Dockerfile
# Caddy proxy injects Origin header (Railway/Cloudflare strips it, n8n requires it for push)
# Docs: https://docs.n8n.io/hosting/installation/docker/

# Stage 1: Download Caddy binary
FROM alpine:latest AS caddy-downloader
ARG TARGETARCH=amd64
RUN apk add --no-cache curl && \
    curl -L -o /tmp/caddy.tar.gz "https://github.com/caddyserver/caddy/releases/download/v2.8.4/caddy_2.8.4_linux_${TARGETARCH}.tar.gz" && \
    tar -xzf /tmp/caddy.tar.gz -C /tmp && \
    chmod +x /tmp/caddy

# Stage 2: n8n + Caddy
FROM n8nio/n8n:2.46.3
COPY --from=caddy-downloader /tmp/caddy /usr/local/bin/caddy
USER root
COPY Caddyfile /etc/caddy/Caddyfile
COPY start.sh /start.sh
RUN chmod +x /start.sh
USER node

ENV XDG_DATA_HOME=/tmp/.caddy
ENV XDG_CONFIG_HOME=/tmp/.caddy

# Ports: Caddy 5678 -> n8n 5680, Task Broker auto-uses 5679
ENV N8N_PUSH_BACKEND=sse
ENV N8N_PROXY_HOPS=1
ENV N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=true
ENV N8N_PERSONALIZATION_ENABLED=false
ENV N8N_DIAGNOSTICS_ENABLED=false
# Set N8N_SECURE_COOKIE=true when you serve n8n over HTTPS.
ENV N8N_SECURE_COOKIE=false
ENV EXECUTIONS_MODE=regular
ENV PORT=5678

EXPOSE 5678

ENTRYPOINT ["/start.sh"]
