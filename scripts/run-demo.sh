#!/usr/bin/env bash
# Starts the whole demo on this laptop: the Cache Pack server, the Hub at Betrawati and Sensors
# S0 to S3 on loopback, each with its own port, slot, data folder, position and track.
# Ctrl-C stops everything. Setup notes: scripts/demo-setup.md.
set -euo pipefail

cd "$(dirname "$0")/.."
# Secrets (CARTO_API_KEY) live in .env; Nodes read the environment, not the file.
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

demo_dir="${DEMO_DIR:-$PWD/.demo}"
base_port="${DEMO_BASE_PORT:-8000}" # the Hub; S0 to S3 take the next four
pack_port="${DEMO_PACK_PORT:-8900}"
slot_base="${DEMO_SLOT_BASE:-0}" # raise it if another Node on this laptop already holds slot 0
pack_release="${DEMO_PACK_RELEASE:-cache-pack-v3}"

mkdir -p "$demo_dir/pack" "$demo_dir/logs"
pids=()

stop_all() {
  trap '' INT TERM
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  # Reticulum can hang on shutdown; force it so the ports are freed.
  for _ in 1 2 3 4 5; do
    alive=0
    for pid in "${pids[@]}"; do
      if kill -0 "$pid" 2>/dev/null; then alive=1; fi
    done
    [ "$alive" = 0 ] && break
    sleep 1
  done
  for pid in "${pids[@]}"; do kill -9 "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap 'stop_all; exit 0' INT TERM
trap stop_all EXIT

if [ ! -f "$demo_dir/pack/cache-pack.zip" ]; then
  # The repo is private, so the Release link needs a login; gh has one. Download beside the final
  # name so an interrupted download is not mistaken for the pack on the next start.
  rm -rf "$demo_dir/pack-download"
  gh release download "$pack_release" --pattern cache-pack.zip --dir "$demo_dir/pack-download"
  mv "$demo_dir/pack-download/cache-pack.zip" "$demo_dir/pack/cache-pack.zip"
fi
if [ ! -f dashboard/dist/index.html ]; then
  (cd dashboard && pnpm install --frozen-lockfile --silent && pnpm build >/dev/null)
fi
(cd node && uv sync --quiet)

# Stopping this server (kill $(cat .demo/pack-server.pid)) is the demo's "cut the internet".
python3 -m http.server "$pack_port" --bind 127.0.0.1 --directory "$demo_dir/pack" \
  >"$demo_dir/logs/pack-server.log" 2>&1 &
pids+=($!)
echo "$!" >"$demo_dir/pack-server.pid"

start_node() {
  local name=$1 role=$2 slot=$3 lat=$4 lon=$5 track=$6 pack_url=$7 hub_identity=$8
  # Run the venv binary directly: under `uv run` the Node is a child of uv, and
  # stopping uv would leave the Node running and holding its ports.
  env NODE_NAME="$name" NODE_ROLE="$role" NODE_PORT=$((base_port + slot)) \
    NODE_MESH_INTERFACE=loopback NODE_LOOPBACK_SLOT=$((slot_base + slot)) \
    NODE_LATITUDE="$lat" NODE_LONGITUDE="$lon" NODE_REPLAY_TRACK="$track" \
    NODE_DATA_DIR="$demo_dir/$name/data" CACHE_PACK_DIR="$demo_dir/$name/cache-pack" \
    CACHE_PACK_URL="$pack_url" HUB_IDENTITY="$hub_identity" \
    node/.venv/bin/storm-shield-node >"$demo_dir/logs/$name.log" 2>&1 &
  pids+=($!)
}

# Positions are the spec's Demo Nodes (docs/specs/flash-flood-replay.md, "Region and Nodes").
start_node hub hub 0 27.9731 85.1860 "" "http://127.0.0.1:$pack_port/cache-pack.zip" ""

hub_identity=""
for _ in $(seq 60); do
  hub_identity="$(sed -n 's/.*Node \([0-9a-f]*\) (hub) is up.*/\1/p' "$demo_dir/logs/hub.log")"
  [ -n "$hub_identity" ] && break
  sleep 1
done
if [ -z "$hub_identity" ]; then
  echo "the Hub did not report its identity; see $demo_dir/logs/hub.log" >&2
  exit 1
fi

sensor_pack="http://127.0.0.1:$base_port/api/cache-pack.zip"
start_node s0 sensor 1 28.3517 85.4477 S0 "$sensor_pack" "$hub_identity"
start_node s1 sensor 2 28.2528 85.3667 S1 "$sensor_pack" "$hub_identity"
start_node s2 sensor 3 28.1632 85.3391 S2 "$sensor_pack" "$hub_identity"
start_node s3 sensor 4 27.9215 85.1460 S3 "$sensor_pack" "$hub_identity"

echo "Hub identity: $hub_identity"
echo "Projector (Hub Panel): http://localhost:$base_port"
# Every address except loopback, link-local and Tailscale (printed below).
for ip in $(ifconfig | awk '/inet / && $2 !~ /^(127|100|169\.254)\./ { print $2 }'); do
  echo "Phones on the hotspot: http://$ip:$base_port"
done
if command -v tailscale >/dev/null 2>&1; then
  tailscale_ip="$(tailscale ip -4 2>/dev/null | head -1 || true)"
  if [ -n "$tailscale_ip" ]; then
    echo "Phones on Tailscale:   http://$tailscale_ip:$base_port"
  fi
fi
echo "Sensors S0 to S3 on ports $((base_port + 1)) to $((base_port + 4)). Logs in $demo_dir/logs. Ctrl-C stops everything."
wait
