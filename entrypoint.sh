#!/bin/sh
set -e

echo "[summoned-gateway] Running database migrations..."
bun run db:migrate

echo "[summoned-gateway] Starting gateway..."
exec bun dist/index.mjs
