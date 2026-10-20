#!/usr/bin/env bash
# Keeps a Node running on whatever this checkout has: when HEAD moves (git pull,
# merge, branch switch), rebuilds the dashboard and restarts the Node.
# Uncommitted edits do not trigger a restart.
# This is for the Pi's Hub (NODE_ROLE defaults to hub). A laptop that joins a Hub as a Sensor,
# WSL2 and Docker included, uses scripts/join-demo.sh instead: it finds the Hub's id and signs up.
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
# A Hub also listens for TCP, so a laptop that cannot do Wi-Fi discovery (WSL2, Docker) can dial it.
[ "$NODE_ROLE" = hub ] && export NODE_ALSO_TCP_LISTEN="${NODE_ALSO_TCP_LISTEN:-1}"
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

build() {
  (cd dashboard && pnpm install --frozen-lockfile --silent && pnpm build >/dev/null) || return 1
  # A plain sync removes lgpio, which only the pi group installs, so the Pi needs the group.
  if grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    (cd node && uv sync --quiet --group pi) || return 1
  else
    (cd node && uv sync --quiet) || return 1
  fi
}

# Builds first and swaps the Node only when the build worked, so a bad pull never
# leaves the Hub down.
start_node() {
  if ! build; then
    if [ -n "$node_pid" ]; then
      echo "build of $(git rev-parse --short HEAD) failed; still running the previous Node" >&2
    else
      echo "build of $(git rev-parse --short HEAD) failed; no Node started" >&2
    fi
    return 1
  fi
  stop_node
  # Run the venv binary directly: under `uv run` the Node is a child of uv, and
  # stopping uv would leave the Node running and holding its ports.
  (cd node && exec .venv/bin/storm-shield-node) &
  node_pid=$!
  echo "running $(git rev-parse --short HEAD) as $NODE_NAME ($NODE_ROLE)"
}

start_node || exit 1
running_commit="$(git rev-parse HEAD)"
while sleep "$interval"; do
  if [ "$(git rev-parse HEAD)" != "$running_commit" ]; then
    running_commit="$(git rev-parse HEAD)"
    start_node || true
  fi
done
