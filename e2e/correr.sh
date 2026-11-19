#!/usr/bin/env bash
# Corre el E2E con una API falsa NUEVA (estado limpio) y el sitio ya construido y levantado en WEB (por defecto :3100).
# Requisitos: `npm run build` hecho con FLORAVIA_API_URL=http://localhost:5099 y `next start -p 3100` en marcha.
set -euo pipefail
cd "$(dirname "$0")/.."
pkill -f e2e/api-falsa.mjs 2>/dev/null || true
PAGO_BANCO="Banco de PRUEBA" PAGO_TIPO="Ahorros" PAGO_NUM="000111222" PAGO_TITULAR="Titular de Prueba" PAGO_ID="0999999999" \
  node e2e/api-falsa.mjs > /tmp/api-falsa.log 2>&1 &
API_PID=$!
trap 'kill $API_PID 2>/dev/null || true' EXIT
sleep 1
NODE_PATH="${NODE_PATH:-$(npm root -g)}" node e2e/flujo.mjs
