#!/usr/bin/env bash
# E2E del modo demostracion: construye y levanta el sitio SIN API (puerto 3101) con datos locales limpios.
set -euo pipefail
cd "$(dirname "$0")/.."
export FLORAVIA_DEMO_DATA="$(mktemp -d)/tienda.json"
env -u FLORAVIA_API_URL npm run build > /tmp/build-demo.log 2>&1 || { tail -30 /tmp/build-demo.log; exit 1; }
env -u FLORAVIA_API_URL npx next start -p 3101 > /tmp/start-demo.log 2>&1 &
PID=$!
export PID
trap 'pkill -P $PID 2>/dev/null; kill $PID 2>/dev/null; pkill -f "next start -p 3101" 2>/dev/null || true' EXIT
for _ in $(seq 1 30); do curl -sf http://localhost:3101/ >/dev/null && break; sleep 1; done
NODE_PATH="${NODE_PATH:-$(npm root -g)}" node e2e/flujo-demo.mjs
