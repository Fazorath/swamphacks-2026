# Demo laptop setup

`scripts/run-demo.sh` starts the Cache Pack server, the Hub at Betrawati and Sensors S0 to S3 on
loopback, then prints the dashboard addresses. Ctrl-C stops all of it.

## Before the demo (once, with internet)

1. `gh auth login`. The repo is private, so the first start downloads Release `cache-pack-v6`
   through `gh` into `.demo/pack/` (2.4 MB, but it took about 6 minutes once; do it at home).
2. Run `scripts/run-demo.sh` once and stop it. That first start also installs and builds what is
   missing (`pnpm install`, `pnpm build`, `uv sync`). Later starts need no internet: they rebuild
   the dashboard only when its sources changed, and never download.
3. Put `CARTO_API_KEY` in `.env` if you want live map tiles; the pack already holds the tiles.

## On the day

1. Put the laptop and both phones on one network the laptop controls. macOS Internet Sharing
   cannot share Wi-Fi back out over Wi-Fi, so on a Wi-Fi-only MacBook give it a wired upstream
   (Ethernet, or an iPhone over USB) and share that over Wi-Fi; or join all three to one phone's
   hotspot. Not yet tried on the demo laptop: check it the day before.
2. `scripts/run-demo.sh`. It prints the Hub's identity, the projector address
   (`http://localhost:8000`), one address per network for the phones, and the Tailscale address.
   It refuses to start if any of its ports is taken (another Node, an old run).
3. Projector: mirror or extend the display and open the Projector address full screen. The Hub
   Panel holds Start, Pause, Reset and the phase jumps.
4. Phone 1: open the laptop's address on the shared network and set a Household Profile at
   **Syabrubesi** (28.1632 N, 85.3391 E; higher ground). Phone 2: **Betrawati** (27.9731 N,
   85.1860 E; a Shelter). The Household Profile never leaves the phone.
5. Reset on the Hub Panel (paused at 08:30), then Start.
6. "Cut the internet" at the replay's cue, both halves: `kill $(cat .demo/pack-server.pid)` in a
   second terminal, and switch off the laptop's upstream (unplug it, or stop the USB tether). The
   Nodes judge "online" by reaching the internet themselves, so the Hub only shows Mesh-only once
   the upstream is gone. Readings keep flowing over the Mesh.

## Settings

`DEMO_BASE_PORT` (Hub, default 8000; S0 to S3 take the next four) and `DEMO_SLOT_BASE` (loopback
slot of the Hub, default 0) move the demo off ports and slots another Node on the laptop holds.
`DEMO_TCP_PORT` (default 4242) is the Hub's TCP listener. The Hub also listens on Wi-Fi discovery
(UDP 29716 and 42671), so an Audience Node on another laptop can join: see `scripts/join-demo.md`.
State and logs live in `.demo/`; delete it to start from nothing.

## What this does not prove

Everything runs on one machine over loopback. Wi-Fi discovery between real devices and any
Raspberry Pi stay unproven. Registering S0 to S3 with the Hub waits for ticket 0012. No Node has a
River km setting yet, so the script gives each Node only its position and track; the ETA reads
River km from the Cache Pack's river line.
