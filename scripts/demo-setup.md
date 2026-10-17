# Demo laptop setup

`scripts/run-demo.sh` starts the Cache Pack server, the Hub at Betrawati and Sensors S0 to S3 on
loopback, then prints the dashboard addresses. Ctrl-C stops all of it.

## Before the demo (once, with internet)

1. `cd node && uv sync` and `cd dashboard && pnpm install && pnpm build`.
2. `gh auth login`. The repo is private, so the script downloads Release `cache-pack-v3` through
   `gh` into `.demo/pack/` the first time (about 2.4 MB; it was slow on conference-grade
   connections, so do this at home). After that no internet is needed.
3. Put `CARTO_API_KEY` in `.env` if you want live map tiles; the pack already holds the tiles.

## On the day

1. Turn on the laptop's hotspot (macOS: System Settings, General, Sharing, Internet Sharing).
   Phones join it. No venue Wi-Fi is needed.
2. `scripts/run-demo.sh`. It prints the Hub's identity, the projector address
   (`http://localhost:8000`) and one address per network for the phones (hotspot and Tailscale).
3. Projector: mirror or extend the display and open the Projector address full screen. The Hub
   Panel holds Start, Pause, Reset and the phase jumps.
4. Phone 1: open the hotspot address and set a Household Profile at **Syabrubesi**
   (28.1632 N, 85.3391 E; higher ground). Phone 2: **Betrawati** (27.9731 N, 85.1860 E; a Shelter).
   The Household Profile never leaves the phone.
5. Reset on the Hub Panel (paused at 08:30), then Start.
6. "Cut the internet" at the replay's cue: `kill $(cat .demo/pack-server.pid)` in a second terminal.
   Readings keep flowing over the Mesh.

## Settings

Environment variables read by the script: `DEMO_BASE_PORT` (Hub, default 8000; S0 to S3 take the
next four), `DEMO_PACK_PORT` (8900), `DEMO_SLOT_BASE` (loopback slot of the Hub, default 0; raise
it if another Node on the laptop holds slot 0), `DEMO_DIR` (state and logs, default `.demo/`),
`DEMO_PACK_RELEASE`. Delete `.demo/` to start from nothing.

## What this does not prove

Everything runs on one machine over loopback. Wi-Fi discovery between real devices and any
Raspberry Pi stay unproven. Registering S0 to S3 with the Hub waits for ticket 0012.
