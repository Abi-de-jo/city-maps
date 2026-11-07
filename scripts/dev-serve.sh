#!/usr/bin/env bash
# Serve the web app + styles + tiles locally on http://localhost:8080.
# Runs in the foreground (attach it to a terminal, or run it in the background).
set -euo pipefail
source "$(dirname "$0")/lib.sh"

runtime="$(pick_runtime)"
root="$(cd "$(dirname "$0")/.." && pwd)"
port="${PORT:-8090}"

echo "==> http://localhost:${port}  (runtime ${runtime})"
exec "${runtime}" run --rm \
  -p "${port}:80" \
  -v "${root}/web:/srv/web:ro" \
  -v "${root}/styles:/srv/styles:ro" \
  -v "${root}/data:/srv/data:ro" \
  -v "${root}/infra/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  docker.io/library/caddy:2
