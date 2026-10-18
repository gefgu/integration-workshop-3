#!/usr/bin/env bash
# Starts the server API (8000), the simulated bench service (8765) and Vite (website + bench screen).
set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/teacher_authoring_app"
VENV_BIN="$ROOT_DIR/graph_validator/.venv/bin"
[[ -d "$VENV_BIN" ]] || VENV_BIN="$ROOT_DIR/graph_validator/.venv/Scripts"

if [[ ! -e "$VENV_BIN/uvicorn" && ! -e "$VENV_BIN/uvicorn.exe" ]]; then
  echo "API not installed in graph_validator/.venv" >&2
  echo "Set it up with: cd graph_validator && python3 -m venv .venv && .venv/bin/pip install -e '.[dev]' -e ../bench/service" >&2
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
npm run migrate
npm run validator &
validator_pid=$!
npm run bench-service &
bench_pid=$!
npm run dev -- --host &
web_pid=$!

cleanup() {
  kill "$validator_pid" "$bench_pid" "$web_pid" 2>/dev/null || true
  wait "$validator_pid" "$bench_pid" "$web_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait -n "$validator_pid" "$bench_pid" "$web_pid"
