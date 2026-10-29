#!/usr/bin/env bash
# Find free localhost ports and run the TedTronics API, bench screen/service, and website.
# Usage: ./run-local.sh [--mobile]   (--mobile also starts Expo for the phone app, with a clean cache)
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PYTHON="$ROOT_DIR/graph_validator/.venv/bin/python"
ALEMBIC="$ROOT_DIR/graph_validator/.venv/bin/alembic"
APP_DIR="$ROOT_DIR/teacher_authoring_app"
MOBILE_DIR="$ROOT_DIR/teacher_mobile_app"
WITH_MOBILE=0
[[ "${1:-}" == "--mobile" ]] && WITH_MOBILE=1

if [[ ! -x "$PYTHON" || ! -x "$ALEMBIC" || ! -d "$APP_DIR/node_modules" ]]; then
  echo "Missing project Python environment or web dependencies. Follow README.md setup first." >&2
  exit 1
fi

# Neon: .env.local (written by `neon link`) holds the Postgres URLs. Migrations use
# the direct (unpooled) connection; the API uses the pooled one. Without the file the
# API falls back to the local SQLite database.
if [[ -f "$ROOT_DIR/.env.local" ]]; then
  set -a; source "$ROOT_DIR/.env.local"; set +a
  MIGRATE_URL="${DATABASE_URL_UNPOOLED:-${DATABASE_URL:-}}"
  export TEDTRONICS_DATABASE_URL="${TEDTRONICS_DATABASE_URL:-${DATABASE_URL:-}}"
fi

free_port() {
  "$PYTHON" -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()'
}

API_PORT="$(free_port)"
BENCH_PORT="$(free_port)"
while [[ "$BENCH_PORT" == "$API_PORT" ]]; do BENCH_PORT="$(free_port)"; done
WEB_PORT="$(free_port)"
while [[ "$WEB_PORT" == "$API_PORT" || "$WEB_PORT" == "$BENCH_PORT" ]]; do WEB_PORT="$(free_port)"; done

TEDTRONICS_DATABASE_URL="${MIGRATE_URL:-${TEDTRONICS_DATABASE_URL:-}}" "$ALEMBIC" -c "$ROOT_DIR/graph_validator/alembic.ini" upgrade head

api_pid= bench_pid= web_pid= mobile_pid=
cleanup() {
  trap - EXIT INT TERM
  for pid in "$mobile_pid" "$web_pid" "$bench_pid" "$api_pid"; do
    [[ -n "$pid" ]] && kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd "$ROOT_DIR"
"$PYTHON" -m uvicorn graph_validator.service.app:app --host 127.0.0.1 --port "$API_PORT" & api_pid=$!
TEDTRONICS_BENCH_DEV=1 TEDTRONICS_BENCH_DB="$ROOT_DIR/bench/service/bench.sqlite3" \
  "$PYTHON" -m bench_service --dev --host 127.0.0.1 --port "$BENCH_PORT" \
  --db "$ROOT_DIR/bench/service/bench.sqlite3" & bench_pid=$!
cd "$APP_DIR"
TEDTRONICS_API_PORT="$API_PORT" VITE_BENCH_PORT="$BENCH_PORT" \
  npm run dev -- --host 127.0.0.1 --port "$WEB_PORT" --strictPort & web_pid=$!

if [[ "$WITH_MOBILE" == 1 ]]; then
  (cd "$MOBILE_DIR" && exec npx expo start -c) & mobile_pid=$!
fi

if [[ "${TEDTRONICS_DATABASE_URL:-}" == postgres* ]]; then DB_LABEL="Neon (${NEON_BRANCH:-?})"; else DB_LABEL="local SQLite"; fi
if [[ "${TEDTRONICS_DATABASE_URL:-}" == postgres* && -z "${TEDTRONICS_BENCH_SECRET:-}" ]]; then
  echo "WARNING: TEDTRONICS_BENCH_SECRET is not set in .env.local; bench tokens from Neon will not verify." >&2
fi

echo "TedTronics is starting (database: $DB_LABEL):"
echo "  Teacher website: http://127.0.0.1:$WEB_PORT/"
echo "  Bench screen:    http://127.0.0.1:$WEB_PORT/bench.html"
echo "  API:             http://127.0.0.1:$API_PORT/"
echo "  Bench service:   http://127.0.0.1:$BENCH_PORT/"
[[ "$WITH_MOBILE" == 1 ]] && echo "  Phone app:       Expo is starting in this terminal output (scan the QR code)."
echo "Press Ctrl+C to stop all services."

wait -n "$api_pid" "$bench_pid" "$web_pid"
echo "A service exited; stopping the remaining services." >&2
exit 1
