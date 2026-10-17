#!/usr/bin/env bash
# Keeps a Node running on the latest `main`: polls origin and, when main moved,
# rebuilds the dashboard and restarts the Node.
# Run it from a checkout that stays on main (no feature work in it).
set -euo pipefail

cd "$(dirname "$0")/.."
export NODE_ROLE="${NODE_ROLE:-hub}"
export NODE_NAME="${NODE_NAME:-hub-1}"
interval="${INTERVAL:-10}"

node_pid=""
stop_node() {
  if [ -n "$node_pid" ]; then
    kill "$node_pid" 2>/dev/null || true
    wait "$node_pid" 2>/dev/null || true
    node_pid=""
  fi
}
trap 'stop_node; exit 0' INT TERM

start_node() {
  stop_node
  (cd dashboard && pnpm install --frozen-lockfile --silent && pnpm build --silent)
  (cd node && uv sync --quiet)
  (cd node && exec uv run storm-shield-node) &
  node_pid=$!
  echo "running $(git rev-parse --short HEAD) as $NODE_NAME ($NODE_ROLE)"
}

start_node
while sleep "$interval"; do
  git fetch --quiet origin main
  if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
    if git merge --ff-only --quiet origin/main; then
      start_node
    else
      echo "cannot fast-forward; keep this checkout on main"
    fi
  fi
done
