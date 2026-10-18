#!/usr/bin/env bash
# Joins the demo Hub's Mesh as an Audience Node: a Sensor Node with its own name and a Nepal
# position, signed up with the Hub. Run it natively on Linux (finds the Hub by Wi-Fi discovery) or
# as the entrypoint of the Docker image (dials the Hub over TCP). Ctrl-C stops it.
# Runbook: scripts/join-demo.md.
set -euo pipefail

usage() {
  echo "usage: scripts/join-demo.sh <hub address> <town | name lat lon>" >&2
  echo "  hub address: host[:port] of the Hub's dashboard, e.g. 192.168.1.20 or 192.168.1.20:8000" >&2
  echo "  town: one below (name and position), or any name (letters, digits, - and _) with <lat> <lon>" >&2
  echo "  each laptop needs its own name" >&2
  echo "  towns: $(town_names)" >&2
  exit 2
}

# Approximate positions of towns near the valley, for the map only.
town_position() {
  case "$(echo "$1" | tr '[:upper:]' '[:lower:]')" in
    dhunche) echo "Dhunche 28.1090 85.2990" ;;
    trishuli) echo "Trishuli 27.9140 85.1600" ;;
    kakani) echo "Kakani 27.8120 85.2570" ;;
    dhading) echo "Dhading 27.8670 84.9170" ;;
    kathmandu) echo "Kathmandu 27.7172 85.3240" ;;
    *) return 1 ;;
  esac
}
town_names() { echo "Dhunche Trishuli Kakani Dhading Kathmandu"; }

[ $# -eq 2 ] || [ $# -eq 4 ] || usage
hub="${1#http://}"
hub="${hub%/}"
case "$hub" in *:*) ;; *) hub="$hub:8000" ;; esac
hub_host="${hub%:*}"

if [ $# -eq 4 ]; then
  name="$2" lat="$3" lon="$4"
else
  position="$(town_position "$2")" || {
    echo "unknown town '$2'; give a latitude and longitude too, or pick one of: $(town_names)" >&2
    exit 2
  }
  read -r name lat lon <<<"$position"
fi
# The name goes into a pattern that finds the Node's id in its log, and the position into a Node
# setting, so refuse anything that is not plain.
[[ "$name" =~ ^[A-Za-z0-9_-]{1,32}$ ]] || {
  echo "the name must be 1 to 32 letters, digits, - or _: '$name'" >&2
  exit 2
}
for coordinate in "$lat" "$lon"; do
  [[ "$coordinate" =~ ^-?[0-9]+(\.[0-9]+)?$ ]] || {
    echo "latitude and longitude must be numbers, like 28.109 85.299: '$coordinate'" >&2
    exit 2
  }
done

cd "$(dirname "$0")/.."
join_dir="${JOIN_DIR:-$PWD/.join-demo}" # keeps the Node id, so the Hub's accept stays valid
mesh="${JOIN_MESH:-${NODE_MESH_INTERFACE:-auto}}" # auto: Wi-Fi discovery; tcp: dial the Hub
hub_tcp_port="${JOIN_HUB_TCP_PORT:-4242}"
port="${NODE_PORT:-8000}"
wifi_discovery_ports="29716 42671" # UDP, Reticulum's AutoInterface

command -v lsof >/dev/null 2>&1 || { echo "lsof is needed to check the ports (apt install lsof)" >&2; exit 1; }
# A Node that cannot bind its port still logs its identity first, so refuse to start over anything
# listening: an old run would otherwise answer for the new one.
busy=""
case "$mesh" in
  auto)
    for udp_port in $wifi_discovery_ports; do
      if lsof -nP -iUDP:"$udp_port" >/dev/null 2>&1; then busy="$busy $udp_port/udp"; fi
    done
    ;;
  tcp) tcp_ports="${NODE_TCP_PORT:-4242}" ;;
  loopback) tcp_ports="$((4250 + ${NODE_LOOPBACK_SLOT:-0}))" ;;
  *) echo "JOIN_MESH must be auto or tcp (loopback is for rehearsing on one machine), not '$mesh'" >&2; exit 2 ;;
esac
for tcp_port in "$port" ${tcp_ports:-}; do
  if lsof -nP -iTCP:"$tcp_port" -sTCP:LISTEN >/dev/null 2>&1; then busy="$busy $tcp_port"; fi
done
if [ -n "$busy" ]; then
  echo "ports already in use:$busy; stop what holds them (an old run?), or set NODE_PORT" >&2
  exit 1
fi

# The Hub's dashboard answers over plain HTTP whenever the network is right, so this is the one
# check that is certain before the Node starts. The Hub's id also tells the Node whose messages to
# believe.
hub_state="$(curl -fsS --max-time 5 "http://$hub/api/state" 2>/dev/null || true)"
case "$hub_state" in
  *'"role":"hub"'*) ;;
  *)
    echo "no Hub answered at http://$hub/api/state" >&2
    echo "  - are this laptop and the Hub laptop on the same network? (not a guest Wi-Fi that isolates clients)" >&2
    echo "  - is the address the Hub's, not a Sensor's? run-demo.sh prints it" >&2
    echo "  - on the Hub laptop, is the Hub up on that port?" >&2
    exit 1
    ;;
esac
hub_identity="$(echo "$hub_state" | grep -o '"id": *"[0-9a-f]*"' | head -1 | sed 's/.*"\([0-9a-f]*\)"$/\1/')"
if [ -z "$hub_identity" ]; then
  echo "http://$hub answered, but not with a Hub identity; is it a Storm Shield Hub?" >&2
  exit 1
fi

if [ "$mesh" = tcp ] && ! (exec 3<>"/dev/tcp/$hub_host/$hub_tcp_port") 2>/dev/null; then
  echo "warning: the Hub's TCP port $hub_host:$hub_tcp_port does not accept connections; is the Hub" >&2
  echo "  started with scripts/run-demo.sh (it listens there), and is that port open on the Hub laptop?" >&2
fi
if [ "$mesh" = auto ]; then
  # Warnings only: each is a common reason for Wi-Fi discovery finding nobody, none is certain.
  if command -v ip >/dev/null 2>&1 && ! ip -6 addr show scope link 2>/dev/null | grep inet6 >/dev/null; then
    echo "warning: no IPv6 link-local address on this laptop; Wi-Fi discovery needs one" >&2
  elif command -v ifconfig >/dev/null 2>&1 && ! ifconfig | grep 'inet6 fe80' >/dev/null; then
    echo "warning: no IPv6 link-local address on this laptop; Wi-Fi discovery needs one" >&2
  fi
  if [[ "$hub_host" =~ ^[0-9]+\.[0-9]+\.[0-9]+\. ]]; then
    # Linux has `ip`, macOS `ifconfig`; the one that is missing must not end the script.
    own_networks="$({ ip -4 -o addr show 2>/dev/null | awk '{print $4}' || true; \
      ifconfig 2>/dev/null | awk '/inet / {print $2}' || true; } | cut -d. -f1-3)"
    if ! echo "$own_networks" | grep -qx "$(echo "$hub_host" | cut -d. -f1-3)"; then
      echo "warning: the Hub's address ($hub_host) is not on one of this laptop's networks" >&2
    fi
  fi
  if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
    echo "warning: firewalld is running; if the Hub is not heard, open the discovery ports on the Wi-Fi zone:" >&2
    echo "  sudo firewall-cmd --zone=<zone> --add-port=29716/udp --add-port=42671/udp" >&2
  fi
  if [ -x /usr/libexec/ApplicationFirewall/socketfilterfw ] &&
    /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate 2>/dev/null | grep enabled >/dev/null; then
    echo "warning: the macOS firewall is on; allow incoming connections for Python, or switch it off for the demo" >&2
  fi
fi

mkdir -p "$join_dir/data" "$join_dir/cache-pack" "$join_dir/logs"
pid=""

stop_node() {
  trap '' INT TERM
  [ -n "$pid" ] || return 0
  kill "$pid" 2>/dev/null || true
  # Reticulum can hang on shutdown; force it so the ports are freed.
  for _ in 1 2 3 4 5; do
    kill -0 "$pid" 2>/dev/null || break
    sleep 1
  done
  kill -9 "$pid" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap 'exit 0' INT TERM
trap stop_node EXIT

# Each step needs the internet only the first time; the image arrives with all of it built.
if [ -d dashboard/src ]; then
  if [ ! -d dashboard/node_modules ]; then
    (cd dashboard && pnpm install --frozen-lockfile --silent)
  fi
  if [ ! -f dashboard/dist/index.html ] ||
    [ -n "$(find dashboard/src dashboard/index.html -newer dashboard/dist/index.html | head -1)" ]; then
    (cd dashboard && pnpm build >/dev/null)
  fi
fi
if [ ! -x node/.venv/bin/storm-shield-node ]; then
  (cd node && uv sync --quiet)
fi

export NODE_MESH_INTERFACE="$mesh"
[ "$mesh" = tcp ] && export NODE_TCP_PEERS="$hub_host:$hub_tcp_port"
# Run the venv binary directly: under `uv run` the Node is a child of uv, and stopping uv would
# leave the Node running and holding its ports.
env NODE_NAME="$name" NODE_ROLE=sensor NODE_PORT="$port" \
  NODE_LATITUDE="$lat" NODE_LONGITUDE="$lon" \
  NODE_DATA_DIR="$join_dir/data" CACHE_PACK_DIR="$join_dir/cache-pack" \
  CACHE_PACK_URL="http://$hub/api/cache-pack.zip" HUB_IDENTITY="$hub_identity" \
  NODE_WEATHER_FORECAST_URL="http://$hub/api/weather/forecast" \
  node/.venv/bin/storm-shield-node >"$join_dir/logs/node.log" 2>&1 &
pid=$!

own="http://127.0.0.1:$port"
node_id=""
for _ in $(seq 90); do
  node_id="$(sed -n "s/.*Node \([0-9a-f]*\) ($name) is up.*/\1/p" "$join_dir/logs/node.log")"
  # "is up" is logged before the port is bound, so wait for an answer as well.
  [ -n "$node_id" ] && curl -fsS "$own/api/state" >/dev/null 2>&1 && break
  node_id=""
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "the Node stopped while starting; see $join_dir/logs/node.log" >&2
    pid=""
    exit 1
  fi
  sleep 1
done
if [ -z "$node_id" ]; then
  echo "the Node did not come up; see $join_dir/logs/node.log" >&2
  exit 1
fi

curl -fsS -X POST "$own/api/registry/signup" >/dev/null || true

echo "Audience Node '$name' ($node_id) at $lat, $lon is up and joining the Hub ($hub_identity)."
echo "Dashboard on this laptop: $own   Logs: $join_dir/logs/node.log"
echo "To let it count, accept it on the Hub, once: Hub Panel > Registry > Accept '$name', or"
echo "  curl -X POST -H 'Content-Type: application/json' -d '{\"id\":\"$node_id\"}' http://$hub/api/registry/accept"
echo "Ctrl-C stops it."

heard_hub=false
registered=false
waited=0
warned=false
while kill -0 "$pid" 2>/dev/null; do
  state="$(curl -fsS --max-time 2 "$own/api/state" 2>/dev/null || true)"
  if ! $heard_hub && echo "$state" | grep -q "\"id\":\"$hub_identity\""; then
    heard_hub=true
    echo "Heard the Hub over the Mesh."
  fi
  if ! $registered && echo "$state" | grep -q '"registration":"registered"'; then
    registered=true
    echo "Registered: the Hub counts this Node."
  fi
  if ! $heard_hub && ! $warned && [ "$waited" -ge 60 ]; then
    warned=true
    echo "Not heard from the Hub over the Mesh after 60 s (the Hub answers on HTTP, so the network is right). Check:" >&2
    if [ "$mesh" = tcp ]; then
      echo "  - the Hub listens for TCP on $hub_host:$hub_tcp_port (run-demo.sh does); is that port reachable from here?" >&2
    else
      echo "  - firewalld on either laptop: sudo firewall-cmd --zone=<zone> --add-port=29716/udp --add-port=42671/udp" >&2
      echo "  - the macOS firewall, if either laptop is a Mac" >&2
      echo "  - Docker on the Hub laptop, if it shares its connection to this one: sudo iptables -I DOCKER-USER -i <cable> -o <wifi> -j ACCEPT" >&2
      echo "  - a guest or hotel Wi-Fi that isolates clients, or a Hub on a different network" >&2
      echo "  - from Docker without host networking, set JOIN_MESH=tcp" >&2
    fi
  fi
  waited=$((waited + 2))
  sleep 2 &
  wait $! || true
done
echo "the Node stopped; see $join_dir/logs/node.log" >&2
pid=""
exit 1
