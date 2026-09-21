#!/bin/sh
set -e
echo "[entrypoint] Running prisma migrate deploy..."
node_modules/.bin/prisma migrate deploy
echo "[entrypoint] Starting marketing-backend..."
exec node dist/main.js
