#!/usr/bin/env bash
# Turns the Pi's Wi-Fi into a hotspot with no internet that laptops and phones join, or back off:
#   pi/setup-hotspot.sh up      # creates the connection if it is missing, then brings it up
#   pi/setup-hotspot.sh down    # brings it down; the Pi is an ordinary Node again
# The name and password come from HOTSPOT_SSID and HOTSPOT_PASSWORD in .env. Needs NetworkManager
# (Raspberry Pi OS Bookworm), and the Pi's Wi-Fi is busy while it is up: SSH in over Ethernet.
set -euo pipefail

connection="storm-shield-hotspot"
action="${1:-}"

cd "$(dirname "$0")/.."
if [ -f .env ]; then
  set -a
  . ./.env
  set +a
fi

case "$action" in
  up)
    : "${HOTSPOT_SSID:?set HOTSPOT_SSID in .env (see .env.example)}"
    : "${HOTSPOT_PASSWORD:?set HOTSPOT_PASSWORD in .env (see .env.example)}"
    if [ "${#HOTSPOT_PASSWORD}" -lt 8 ]; then
      echo "hotspot: HOTSPOT_PASSWORD must be at least 8 characters (WPA2)" >&2
      exit 1
    fi
    # Recreate rather than edit, so running this twice leaves one hotspot.
    nmcli connection delete "$connection" >/dev/null 2>&1 || true
    # "shared" hands out addresses to the people who join but, with no upstream, routes nowhere.
    # IPv6 link-local is what Reticulum's AutoInterface uses to find the other Nodes.
    # autoconnect is off on purpose: the hotspot never starts by itself at boot.
    nmcli connection add type wifi ifname wlan0 con-name "$connection" autoconnect no \
      ssid "$HOTSPOT_SSID" 802-11-wireless.mode ap 802-11-wireless.band bg \
      wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$HOTSPOT_PASSWORD" \
      ipv4.method shared ipv6.method link-local >/dev/null
    nmcli connection up "$connection"
    echo "hotspot: '$HOTSPOT_SSID' is up; the Pi is at 10.42.0.1"
    ;;
  down)
    nmcli connection down "$connection"
    echo "hotspot: down"
    ;;
  *)
    echo "usage: pi/setup-hotspot.sh up|down" >&2
    exit 2
    ;;
esac
