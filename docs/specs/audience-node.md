# Audience Node

**Status:** ready-for-agent

Ticket 0069. Part of `docs/specs/gods-eye-view.md` (the audience laptop whose Wi-Fi a volunteer turns off and on). Builds on `docs/specs/node-registry.md` and `docs/specs/shelter-status.md` for the registry and the Hub's identity. Words follow `CONTEXT.md`. Decided in the grilling of 2026-10-18.

## Problem Statement

The demo shows a Mesh that survives the internet going down, but every Node on stage is a Simulated Reading source on one laptop. Judges cannot see a Node they can touch join the Mesh, drop off the map when its Wi-Fi goes, and come back. The demo Hub also runs on loopback only, so no other device can reach it, and a laptop that joins with the wrong network, a firewall or a missing Hub identity fails silently: the Node starts and simply never appears.

## Solution

A prepared laptop runs one command, `scripts/join-demo.sh <hub address>`, with a Node name and a Nepal town. It checks it can reach the Hub, starts a Sensor Node that joins the Hub's Mesh (Hub identity, Cache Pack from the Hub, Event clock followed), asks the Hub to register it, and tells the operator what to fix when the Mesh path is not there. The Hub accepts it once, ahead of the show, in the Hub Panel's Registry tab or with one printed `curl` line; the laptop keeps its Node id between runs so it stays accepted.

The same script is the entrypoint of one Docker image, so a Windows laptop (or any laptop) can run it as a container. On Linux the script runs natively, or in the image with host networking, and finds the Hub by Wi-Fi discovery. In a container without host networking (Docker Desktop on Windows) discovery cannot cross the VM's NAT, so the script dials the Hub's address over TCP. To serve both, the demo Hub listens on Wi-Fi discovery and on TCP, beside its loopback Mesh for S0 to S3.

A volunteer turns the laptop's Wi-Fi off: its dot shows Contact lost, then Stale. They turn it on and the dot comes back.

## User Stories

1. As a presenter, I want one command on the audience laptop that joins the demo Mesh, so that I can set it up in a minute.
2. As a presenter, I want the laptop to appear on the God's Eye View with its own name in a Nepal town, so that judges can point at their own device.
3. As a presenter, I want the name and position to come from arguments or a short list of towns, so that two laptops never share a dot.
4. As a presenter, I want the laptop's dot to carry the `REAL` ring and its readings to be described as simulated, so that I never claim a sensor that is not there.
5. As a volunteer, I want to turn Wi-Fi off and see the dot go Contact lost then Stale, so that I see the Mesh is live.
6. As a volunteer, I want the dot to come back when I turn Wi-Fi on, with nobody restarting anything.
7. As a teammate on the Hub, I want to accept the laptop with one Hub Panel click or one pasted `curl` line, so that registering costs seconds.
8. As a teammate, I want the laptop to stay accepted across runs, so that I do the accept once during setup, not on stage.
9. As a teammate, I want the script to print the laptop's Node id and the exact accept line, so that I never hunt for the id.
10. As a presenter, I want the script to stop with a plain message when the Hub's address does not answer or is not a Hub, so that a wrong network or a typo is obvious.
11. As a presenter, I want warnings, not stops, for a missing IPv6 link-local address, a Hub on another subnet or an active firewall, so that a check that is only a guess never blocks a working setup.
12. As a presenter, I want the script to wait about a minute to hear the Hub over the Mesh and then list what to fix (firewalld ports, macOS firewall, Docker forwarding on the Hub laptop, guest Wi-Fi isolation), so that a silent failure becomes a checklist.
13. As a presenter, I want the script to refuse to start when its ports are in use, so that an old run never answers for the new one.
14. As a presenter, I want Ctrl-C to stop the Node and free its ports, so that the laptop is clean for the next run.
15. As a Windows user, I want to run the same image with one `docker run` line, so that I need no Python, `uv` or `pnpm` on the laptop.
16. As a Linux user, I want to run the script natively and have the laptop find the Hub by Wi-Fi discovery, so that the demo shows real Mesh discovery.
17. As a presenter, I want a runbook that says how to prepare the laptop, hand it to a volunteer, and what to do if they close the lid instead (a teammate turns Wi-Fi off), so that nothing depends on memory at 4 am.
18. As a judge reading the repo, I want the runbook and lessons to say what was rehearsed on loopback and what is unproven on real Wi-Fi and on Windows, so that nothing is overclaimed.
19. As the Hub operator, I want the registry to stay inside its one-packet limit, so that a ninth Node is refused with the existing message and not silently dropped.

## Implementation Decisions

- **Hub interfaces.** A Node still has one primary interface (`auto`, `loopback` or `tcp`). Two additions, both off by default, let the Hub reach more than one: adding Wi-Fi discovery beside the primary, and listening for TCP clients on all addresses beside it. `run-demo.sh` turns both on for the Hub only. S0 to S3 stay loopback-only, so the audience laptop never hears their readings; the Hub's own messages (Event clock, registry, Shelter status, warnings) go out on every interface. Transport stays off: the Hub does not relay readings between interfaces.
- **Audience Node settings.** It is a Sensor with `HUB_IDENTITY` set, `CACHE_PACK_URL` and `NODE_WEATHER_FORECAST_URL` pointing at the Hub's HTTP address, no replay track (it publishes the Scenario's calm step) and no `NODE_RIVER_KM`, so it can never start a Community Warning. It keeps its data folder between runs so its Node id, and with it its place in the registry, stays.
- **Hub identity.** Read from the Hub's `/api/state` (`id`), which is why an unreachable or non-Hub address is a hard stop.
- **Mesh mode.** Wi-Fi discovery by default; TCP to the Hub's address when asked (the image's default on a non-host network). The Hub's TCP port is a fixed, documented value the demo script sets.
- **Registration.** After the Node is up, the script posts the Node's own Sign-up (it repeats until accepted) and prints the Hub-side step. It keeps running while it waits and says when the Node is registered.
- **Preflight (Wi-Fi discovery mode only).** Hard stops: Hub unreachable, not a Hub, own ports busy. Warnings: no IPv6 link-local address, different subnet, firewalld or macOS firewall on. After start: hear the Hub within about 60 s or print the fix list. The Docker/TCP path skips the discovery checks and checks the Hub's TCP port instead.
- **Ports.** The script checks its HTTP port and, in discovery mode, the two Wi-Fi discovery UDP ports; in TCP mode its HTTP and TCP ports.
- **Towns.** A short fixed list of Nepal towns near the valley with approximate coordinates; the name defaults to the town. Arguments override both.
- **Image.** One Dockerfile builds the Node and the dashboard; its entrypoint is `join-demo.sh`; identity and state live in a mounted volume. Nothing secret is baked in (the map tiles come from the Hub's pack).
- **Platforms.** Linux native (Wi-Fi discovery) and the image on any Docker host. macOS native and Windows without Docker are not claimed.
- **Glossary.** `CONTEXT.md` gains **Real Node** and **Audience Node**. No ADR: the Hub's extra interfaces are easy to undo.

## Testing Decisions

- A good test checks what a Node or the script does from outside, not how it builds its config.
- **Seam 1 (Node config).** `reticulum_config` already has tests (`test_reticulum_config.py`); add cases for the Hub with Wi-Fi discovery and a TCP listener beside its primary, and for both being off by default.
- **Seam 2 (the script).** `bash -n`, plus a loopback rehearsal: a Hub and an Audience Node as separate processes on one machine, through the same script, proving it reads the Hub identity, the Node gets the pack, signs up, is accepted with the printed line, appears in the Hub's `/api/state` and goes Stale and returns when its process is stopped and restarted. The TCP path is rehearsed the same way against the Hub's TCP listener.
- Prior art: `scripts/run-demo.sh` rehearsals recorded in `docs/agents/lessons.md`.
- The Docker image is built and run on this machine if Docker is here; otherwise it is only reviewed, and the lessons say so.

## Out of Scope

- Real Wi-Fi discovery between devices, the Pi, and Windows host behaviour; they stay unproven and are reported as such.
- A real sensor on the laptop, or a replay track for it.
- Multi-packet registries, or more than about two audience laptops.
- macOS and native Windows support.

## Further Notes

- The ticket's "Hub-side step" is the existing Registry tab and `POST /api/registry/accept`; no new Hub endpoint.
- Wiping the laptop's data folder gives it a new Node id and needs a new accept.
- Docker Desktop's host networking attaches to its VM, not Windows' Wi-Fi adapter, so the TCP path is what Windows gets.
