#!/usr/bin/env bash
# Installs everything a Node needs on a Raspberry Pi, in one go:
#   pi/install.sh
# lgpio, the pin backend the Breadboard uses, builds from source, so its system libraries come
# first. Safe to run again. Needs sudo for apt, and uv (https://astral.sh/uv).
set -euo pipefail

cd "$(dirname "$0")/.."

command -v uv >/dev/null || {
  echo "install: uv is not on PATH. Install it with: curl -LsSf https://astral.sh/uv/install.sh | sh" >&2
  echo "install: then open a new shell (it installs to ~/.local/bin) and run this again." >&2
  exit 1
}

sudo apt-get update
sudo apt-get install -y swig python3-dev build-essential liblgpio-dev

# --group pi adds gpiozero and lgpio. A plain `uv sync` would remove them again, so sync with the
# group every time you sync on the Pi.
(cd node && uv sync --group pi)

(cd node && .venv/bin/python -c "import lgpio, gpiozero")
echo "install: Node installed with Breadboard support."

if [ ! -d dashboard/dist ]; then
  echo "install: dashboard/dist is missing, so the Node has no page to serve. Build it on a laptop" >&2
  echo "install: (cd dashboard && pnpm install && pnpm build) and copy dashboard/dist to the Pi." >&2
fi
