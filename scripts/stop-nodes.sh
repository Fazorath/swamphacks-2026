#!/usr/bin/env bash
# Stops every Storm Shield Node on this machine (any checkout, any worktree) and
# lists whatever still holds a port the Node tests or a local rehearsal use.
# A forgotten Node keeps serving old code and makes test_reticulum_nodes.py fail
# on busy ports.
set -uo pipefail

# Nodes start either as the console script or as `python -c "from storm_shield.main import run; run()"`.
node_patterns=("storm_shield.main import run" "storm-shield-node")

stopped=0
for pattern in "${node_patterns[@]}"; do
  if pkill -f "$pattern" 2>/dev/null; then
    stopped=1
  fi
done
if [ "$stopped" = 1 ]; then
  # Reticulum can hang on shutdown; give it a moment, then force it.
  sleep 2
  for pattern in "${node_patterns[@]}"; do
    pkill -9 -f "$pattern" 2>/dev/null || true
  done
  echo "stopped running Nodes."
else
  echo "no running Nodes found."
fi

# HTTP 8000/8001 (default Nodes), 8101-8103 and TCP 4350-4352 (test_reticulum_nodes.py),
# 4250-4255 (loopback Reticulum slots 0 to 5).
ports=(8000 8001 8101 8102 8103 4250 4251 4252 4253 4254 4255 4350 4351 4352)

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof not found; on Windows check with: Get-NetTCPConnection -State Listen -LocalPort $(IFS=,; echo "${ports[*]}")"
  exit 0
fi

busy=""
for port in "${ports[@]}"; do
  holder="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR == 2 { print $1 " (pid " $2 ")" }')"
  [ -n "$holder" ] && busy+="  port $port: $holder"$'\n'
done
if [ -n "$busy" ]; then
  echo "still listening:"
  printf '%s' "$busy"
  echo "these are not Nodes started by this repo; stop them by hand if they are in the way."
  exit 1
fi
echo "all Node and test ports are free."
