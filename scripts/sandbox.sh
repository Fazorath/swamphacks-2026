#!/usr/bin/env bash
# Starts the Sandbox from anywhere: a Hub and simulated Sensors in one process, then the browser.
# The first run downloads the Region's Cache Pack (or finds the one you built) and builds the dashboard. Arguments go to the command
# (--port, --pack). Setup notes: AGENTS.md, "Try the app with no setup".
set -euo pipefail

cd "$(dirname "$0")/../node"
exec uv run storm-shield-sandbox "$@"
