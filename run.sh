#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/teacher_authoring_app"
VALIDATOR="$ROOT_DIR/graph_validator/.venv/bin/uvicorn"

if [[ ! -x "$VALIDATOR" ]]; then
  echo "API validator not found at $VALIDATOR" >&2
  echo "Set it up with: cd graph_validator && python3 -m venv .venv && .venv/bin/pip install -e '.[dev]'" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to run the web app." >&2
  exit 1
fi

if [[ ! -d "$APP_DIR/node_modules" ]]; then
  echo "Web app dependencies not found. Run 'npm install' in $APP_DIR first." >&2
  exit 1
fi

cd "$APP_DIR"
"$ROOT_DIR/graph_validator/.venv/bin/alembic" -c "$ROOT_DIR/graph_validator/alembic.ini" upgrade head
npm run validator &
validator_pid=$!
npm run dev &
web_pid=$!

cleanup() {
  kill "$validator_pid" "$web_pid" 2>/dev/null || true
  wait "$validator_pid" "$web_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait -n "$validator_pid" "$web_pid"
