#!/bin/sh
# Makes one database per app inside the single Postgres container.
set -e
for db in platform gtm wall n8n; do
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" -c "CREATE DATABASE $db;" || true
done
