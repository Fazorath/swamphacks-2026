#!/usr/bin/env bash
# Keeps a Node running on whatever this checkout has: when HEAD moves (git pull,
# merge, branch switch), rebuilds the dashboard and restarts the Node.
# Uncommitted edits do not trigger a restart.
set -euo pipefail

cd "$(dirname "$0")/.."
# Secrets (CARTO_API_KEY) live in .env; Nodes read the environment, not the file.
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi
export NODE_ROLE="${NODE_ROLE:-hub}"
export NODE_NAME="${NODE_NAME:-hub-1}"
interval="${INTERVAL:-10}"

node_pid=""
stop_node() {
  if [ -n "$node_pid" ]; then
    kill "$node_pid" 2>/dev/null || true
    # Reticulum can hang on shutdown; force it so the ports are freed.
    for _ in 1 2 3 4 5; do
      kill -0 "$node_pid" 2>/dev/null || break
      sleep 1
    done
    kill -9 "$node_pid" 2>/dev/null || true
    wait "$node_pid" 2>/dev/null || true
    node_pid=""
  fi
}
trap 'stop_node; exit 0' INT TERM

start_node() {
  stop_node
  (cd dashboard && pnpm install --frozen-lockfile --silent && pnpm build >/dev/null)
  # A plain sync removes lgpio, which only the pi group installs, so the Pi needs the group.
  if grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    (cd node && uv sync --quiet --group pi)
  else
    (cd node && uv sync --quiet)
  fi
  # Run the venv binary directly: under `uv run` the Node is a child of uv, and
  # stopping uv would leave the Node running and holding its ports.
  (cd node && exec .venv/bin/storm-shield-node) &
  node_pid=$!
  echo "running $(git rev-parse --short HEAD) as $NODE_NAME ($NODE_ROLE)"
}

start_node
running_commit="$(git rev-parse HEAD)"
while sleep "$interval"; do
  if [ "$(git rev-parse HEAD)" != "$running_commit" ]; then
    running_commit="$(git rev-parse HEAD)"
    start_node
  fi
done
