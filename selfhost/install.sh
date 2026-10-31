#!/usr/bin/env sh
# Sako self-host installer. Needs Docker with the compose plugin.
#   curl -fsSL https://raw.githubusercontent.com/wicolian/sako/main/selfhost/install.sh | sh
set -e
DIR="${SAKO_DIR:-sako}"
RAW="https://raw.githubusercontent.com/wicolian/sako/main"

command -v docker >/dev/null || { echo "Install Docker first: https://docs.docker.com/get-docker/"; exit 1; }

mkdir -p "$DIR/docker" && cd "$DIR"
curl -fsSL "$RAW/docker-compose.yml"            -o docker-compose.yml
curl -fsSL "$RAW/docker/init-databases.sh"      -o docker/init-databases.sh
chmod +x docker/init-databases.sh
[ -f .env ] || curl -fsSL "$RAW/.env.example"   -o .env

# Random secrets so nothing runs on defaults.
rand() { LC_ALL=C tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32; }
grep -q '^POSTGRES_PASSWORD=sako$' .env && sed -i.bak "s/^POSTGRES_PASSWORD=sako$/POSTGRES_PASSWORD=$(rand)/" .env
grep -q '^N8N_ENCRYPTION_KEY=change-me$' .env && sed -i.bak "s/^N8N_ENCRYPTION_KEY=change-me$/N8N_ENCRYPTION_KEY=$(rand)/" .env
rm -f .env.bak

docker compose pull
docker compose up -d --no-build

echo ""
echo "Sako is running:"
echo "  Landing  http://localhost:3000    Client  http://localhost:5173"
echo "  Studio   http://localhost:3100    GTM     http://localhost:3002"
echo "  n8n      http://localhost:5678"
echo "Add your keys to $DIR/.env, then: docker compose up -d"
