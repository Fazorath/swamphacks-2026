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

demo_dir="$PWD/.demo"
base_port="${DEMO_BASE_PORT:-8000}" # the Hub; S0 to S3 take the next four
slot_base="${DEMO_SLOT_BASE:-0}"    # raise it if another Node on this laptop already holds slot 0
pack_port=8900
tcp_port="${DEMO_TCP_PORT:-4242}" # the Hub's TCP listener, for an Audience Node behind Docker
wifi_discovery_ports="29716 42671" # UDP, Reticulum's AutoInterface; the Hub's Wi-Fi side holds them
loopback_base_port=4250 # LOOPBACK_BASE_PORT in node/src/storm_shield/reticulum_mesh.py

# A Node that cannot bind its port still logs its identity first, and a stale Node already on
# the port would then answer the projector; so refuse to start over anything listening.
busy=""
for port in "$pack_port" $(seq "$base_port" $((base_port + 4))) \
  $(seq $((loopback_base_port + slot_base)) $((loopback_base_port + slot_base + 4))); do
  if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then busy="$busy $port"; fi
done
if lsof -nP -iTCP:"$tcp_port" -sTCP:LISTEN >/dev/null 2>&1; then busy="$busy $tcp_port"; fi
for port in $wifi_discovery_ports; do
  if lsof -nP -iUDP:"$port" >/dev/null 2>&1; then busy="$busy $port/udp"; fi
done
if [ -n "$busy" ]; then
  echo "ports already in use:$busy; stop what holds them, or set DEMO_BASE_PORT/DEMO_SLOT_BASE" >&2
  exit 1
fi

mkdir -p "$demo_dir/pack" "$demo_dir/logs"
pids=()

stop_all() {
  trap '' INT TERM
  # Written this way because bash 3.2 (macOS) treats an empty "${pids[@]}" as unbound under set -u.
  for pid in ${pids[@]+"${pids[@]}"}; do kill "$pid" 2>/dev/null || true; done
  # Reticulum can hang on shutdown; force it so the ports are freed.
  for _ in 1 2 3 4 5; do
    alive=0
    for pid in ${pids[@]+"${pids[@]}"}; do
      if kill -0 "$pid" 2>/dev/null; then alive=1; fi
    done
    [ "$alive" = 0 ] && break
    sleep 1
  done
  for pid in ${pids[@]+"${pids[@]}"}; do kill -9 "$pid" 2>/dev/null || true; done
  wait 2>/dev/null || true
}
trap 'exit 0' INT TERM
trap stop_all EXIT

# Each step below needs the internet only the first time, so a start on stage never reaches for it.
if [ ! -f "$demo_dir/pack/cache-pack.zip" ]; then
  # The repo is private, so the Release link needs a login; gh has one. Download beside the final
  # name so an interrupted download is not mistaken for the pack on the next start.
  rm -rf "$demo_dir/pack-download"
  gh release download cache-pack-v4 --pattern cache-pack.zip --dir "$demo_dir/pack-download"
  mv "$demo_dir/pack-download/cache-pack.zip" "$demo_dir/pack/cache-pack.zip"
fi
if [ ! -d dashboard/node_modules ]; then
  (cd dashboard && pnpm install --frozen-lockfile --silent)
fi
# Rebuilt when any dashboard source is newer than the build, so a `git pull` is never shown stale.
if [ ! -f dashboard/dist/index.html ] ||
  [ -n "$(find dashboard/src dashboard/index.html -newer dashboard/dist/index.html | head -1)" ]; then
  (cd dashboard && pnpm build >/dev/null)
fi
if [ ! -x node/.venv/bin/storm-shield-node ]; then
  (cd node && uv sync --quiet)
fi

# Stopping this server (kill $(cat .demo/pack-server.pid)) is half of the demo's "cut the internet".
python3 -m http.server "$pack_port" --bind 127.0.0.1 --directory "$demo_dir/pack" \
  >"$demo_dir/logs/pack-server.log" 2>&1 &
pids+=($!)
echo "$!" >"$demo_dir/pack-server.pid"

hub_identity=""

start_node() {
  local name=$1 role=$2 slot=$3 lat=$4 lon=$5 track=$6 river_km=$7 pack_url reachable_from_other_laptops=false
  if [ "$role" = hub ]; then
    pack_url="http://127.0.0.1:$pack_port/cache-pack.zip"
    # S0 to S3 stay on loopback; only the Hub also reaches an Audience Node (scripts/join-demo.md).
    reachable_from_other_laptops=true
  else
    pack_url="http://127.0.0.1:$base_port/api/cache-pack.zip"
  fi
  # Run the venv binary directly: under `uv run` the Node is a child of uv, and
  # stopping uv would leave the Node running and holding its ports.
  env NODE_NAME="$name" NODE_ROLE="$role" NODE_PORT=$((base_port + slot)) \
    NODE_MESH_INTERFACE=loopback NODE_LOOPBACK_SLOT=$((slot_base + slot)) \
    NODE_LOOPBACK_FIRST_SLOT="$slot_base" NODE_TCP_PORT="$tcp_port" \
    NODE_ALSO_WIFI_DISCOVERY="$reachable_from_other_laptops" NODE_ALSO_TCP_LISTEN="$reachable_from_other_laptops" \
    NODE_LATITUDE="$lat" NODE_LONGITUDE="$lon" NODE_RIVER_KM="$river_km" NODE_REPLAY_TRACK="$track" \
    NODE_DATA_DIR="$demo_dir/$name/data" CACHE_PACK_DIR="$demo_dir/$name/cache-pack" \
    CACHE_PACK_URL="$pack_url" HUB_IDENTITY="$hub_identity" \
    NODE_WEATHER_FORECAST_URL="http://127.0.0.1:$base_port/api/weather/forecast" \
    node/.venv/bin/storm-shield-node >"$demo_dir/logs/$name.log" 2>&1 &
  pids+=($!)
}

# Positions are the spec's Demo Nodes (docs/specs/flash-flood-replay.md, "Region and Nodes").
start_node hub hub 0 27.9731 85.1860 "" 45.6
hub_pid=$!

for _ in $(seq 60); do
  hub_identity="$(sed -n 's/.*Node \([0-9a-f]*\) (hub) is up.*/\1/p' "$demo_dir/logs/hub.log")"
  [ -n "$hub_identity" ] && break
  if ! kill -0 "$hub_pid" 2>/dev/null; then
    echo "the Hub stopped while starting; see $demo_dir/logs/hub.log" >&2
    exit 1
  fi
  sleep 1
done
if [ -z "$hub_identity" ]; then
  echo "the Hub did not report its identity; see $demo_dir/logs/hub.log" >&2
  exit 1
fi

start_node s0 sensor 1 28.3517 85.4477 S0 -12.2
start_node s1 sensor 2 28.2528 85.3667 S1 3.4
start_node s2 sensor 3 28.1632 85.3391 S2 14.6
start_node s3 sensor 4 27.9215 85.1460 S3 54.0

# Strict counting: until the Hub has registered a Sensor, nobody counts its readings. The Hub keeps
# its registry in .demo/hub/data, so a second start finds the Sensors already registered.
register_sensor() {
  local name=$1 slot=$2 id registry
  for _ in $(seq 60); do
    id="$(sed -n "s/.*Node \([0-9a-f]*\) ($name) is up.*/\1/p" "$demo_dir/logs/$name.log")"
    [ -n "$id" ] && curl -fsS -X POST "http://127.0.0.1:$((base_port + slot))/api/registry/signup" \
      >/dev/null 2>&1 && break
    sleep 1
  done
  for _ in $(seq 60); do
    registry="$(curl -fsS "http://127.0.0.1:$base_port/api/registry" 2>/dev/null || true)"
    case "$registry" in
      *"\"id\":\"$id\",\"name\":\"$name\",\"status\":\"registered\""*) return 0 ;;
      *"\"id\":\"$id\",\"name\":\"$name\",\"status\":\"waiting\""*)
        curl -fsS -X POST -H 'Content-Type: application/json' -d "{\"id\":\"$id\"}" \
          "http://127.0.0.1:$base_port/api/registry/accept" >/dev/null && return 0
        ;;
    esac
    sleep 1
  done
  echo "could not register $name with the Hub; its readings will not count" >&2
}
register_sensor s0 1
register_sensor s1 2
register_sensor s2 3
register_sensor s3 4

echo "Hub identity: $hub_identity"
echo "Projector (Hub Panel): http://localhost:$base_port"
# Every address except loopback, link-local and Tailscale (printed below); the hotspot's is one.
for ip in $(ifconfig | awk '/inet / && $2 !~ /^(127|100|169\.254)\./ { print $2 }'); do
  echo "Phones on this laptop's networks: http://$ip:$base_port"
done
if command -v tailscale >/dev/null 2>&1; then
  tailscale_ip="$(tailscale ip -4 2>/dev/null | head -1 || true)"
  if [ -n "$tailscale_ip" ]; then
    echo "Phones on Tailscale:   http://$tailscale_ip:$base_port"
  fi
fi
echo "Sensors S0 to S3 on ports $((base_port + 1)) to $((base_port + 4)). Logs in $demo_dir/logs. Ctrl-C stops everything."
wait
