# Peer Mesh in Docker

**Status:** ready-for-agent

Builds on `docs/specs/audience-node.md` (ticket 0069: the join script, its image and the Hub's extra interfaces) and `docs/specs/node-registry.md`. Respects ADR 0002 (the Hub is a Node on the Mesh). Words follow `CONTEXT.md`. Decided in the grilling of 2026-10-18; the two assumptions it rests on were proven that day (see Further Notes).

## Problem Statement

Joining the demo Mesh from a laptop still takes hand work: an Audience Node must start while the Hub answers, Linux laptops hit firewalld blocking Wi-Fi discovery, and the fix list asks people to open ports on their own machine. Worse, every laptop that joins over TCP dials only the Hub. Reticulum does not pass one client's broadcast on to another, so the moment the Hub stops, every Node loses every other Node. The point of a Mesh is that one Node going down, the Hub included, costs nobody the readings of the others, and today it costs everyone.

## Solution

One Docker image runs any Node, Sensor or Hub, chosen by `NODE_ROLE`. A ready-made compose file needs only a Node name and a town; its default Hub address is the Pi's hotspot (`10.88.0.1`). Someone with Docker Engine runs `docker compose up` while still on their own Wi-Fi, then switches the laptop to the Pi's hotspot; the Node waits for the Hub, remembers its identity, and joins. No firewall setting is touched: the container dials out, and Docker's own published-port rules let other Nodes dial in.

Every Node dials every other Node directly. A new laptop needs only the Pi's address: each Node's announce carries the Dial addresses it knows, so the laptop learns the rest from the Pi, dials them, and keeps them on disk. When the Hub stops, the remaining Nodes keep hearing each other's Community Readings, and Stale and Contact lost stay accurate. Hub duties (registry, Shelter status, Community Warnings, Official Alerts, Event clock) pause until the Hub returns or a teammate starts a Hub takeover on a standby laptop that holds a copy of the Hub key. The takeover Hub starts from the last registry and Shelter status the Mesh heard, so every Registered Node keeps counting.

## User Stories

1. As an audience member with Docker Engine on my laptop, I want to start a Node with one `docker compose up`, so that I need no Python, `uv` or `pnpm`.
2. As an audience member, I want to set only a Node name and a town, so that I can join without reading the code.
3. As an audience member, I want the compose file's default Hub address to be the Pi's hotspot, so that most people edit nothing else.
4. As an audience member, I want to start the container on my own Wi-Fi and switch to the Pi's hotspot afterwards, so that the image and Cache Pack download while I still have internet.
5. As an audience member, I want the Node to keep waiting for the Hub instead of exiting, so that the order of starting and switching networks does not matter.
6. As an audience member, I want a plain line saying what the Node is waiting for (the Hub's address), so that I know it is not frozen.
7. As an audience member, I want the Node to remember the Hub's identity after first contact, so that a restart while the Hub is down still trusts the right Hub.
8. As an audience member, I want to join without changing my firewall, so that I never need root or a teammate's help.
9. As an audience member, I want my laptop to appear on the God's Eye View within a minute of joining the hotspot, so that I see it work.
10. As an audience member, I want my Node to keep its Node id between runs, so that it stays a Registered Node after the first accept.
11. As an audience member, I want to pass any other `NODE_*` setting through the compose file untouched, so that a teammate can tune a Node without a new option.
12. As a Node on the Mesh, I want to learn other Nodes' Dial addresses from any Node I reach, so that one known address (the Pi's) is enough to find everyone.
13. As a Node, I want to dial every Node whose Dial address I learn, without restarting, so that the Mesh fills in by itself.
14. As a Node, I want to save the Dial addresses I have learned, so that after a restart I can reach other Nodes even when the Pi or Hub is down.
15. As a Node in a container, I want to learn the address other Nodes see me from, so that I announce my laptop's hotspot address and not Docker's internal one.
16. As a teammate, I want to override a Node's announced Dial address, so that an odd network can still be made to work.
17. As a volunteer watching the map, I want Nodes to keep hearing each other when the Hub stops, so that the Mesh visibly survives losing its Hub.
18. As a volunteer, I want a Node that goes down to turn Contact lost and then Stale on every other Node's dashboard, Hub or no Hub, so that the map never lies.
19. As a resident, I want my dashboard to keep the last Shelter status and my Flood Risk while the Hub is gone, so that I still have a plan.
20. As a teammate, I want to start a Hub takeover on a standby laptop by starting it as the Hub with a copy of the Hub key, so that warnings and Shelter changes resume in a minute.
21. As a teammate, I want the takeover Hub to start from the last registry and Shelter status it heard, so that every Registered Node keeps counting toward Flood Risk.
22. As a teammate, I want the takeover Hub's registry and Shelter status `ver` to be higher than the old Hub's, so that every Node accepts them.
23. As a teammate, I want the Hub key to exist only on the Hub and on the one standby I chose, so that a stolen laptop cannot sign warnings.
24. As a teammate, I want the same image to run the Hub on a laptop, so that the standby needs nothing installed beyond Docker.
25. As the Pi operator, I want the Pi to stay a native Node (Breadboard and hotspot need the host) that listens for TCP and announces its Dial address, so that it is the address everyone starts from.
26. As a teammate, I want to build the image from a clone with `docker compose up --build`, so that it works while the repo is private.
27. As a teammate, I want a `docker save` tarball of the image, so that a laptop without repo access can load it from a USB stick.
28. As a presenter, I want a short runbook (prepare, hand over, switch networks, stop the Hub, take over), so that nothing depends on memory at 4 am.
29. As a judge reading the repo, I want the lessons log to say what was rehearsed on one laptop and what was checked on the Pi, so that nothing is overclaimed.
30. As a Linux user who wants Wi-Fi discovery too, I want a documented host-network override, so that the default path stays firewall-free.

## Implementation Decisions

- **Topology.** Direct full mesh over TCP: every Node listens on its TCP port and dials every Dial address it knows. Reticulum transport stays off; the Pi is not a relay, it is the first Dial address. This replaces "dial only the Hub" for Nodes started from the image. Loopback and Wi-Fi discovery modes are unchanged.
- **Dial address.** `host:port` that another Node can dial to reach this Node. A Node's announce (already sent every 10 s) carries in its app data the list of Dial addresses it knows, its own first. The list is capped to fit one announce (about 10 addresses in about 300 bytes); a Node keeps the most recently heard ones. The format is versioned like other wire formats (`docs/specs/wire-formats.md` gains it).
- **Address book.** A small deep module on the Node owns Dial addresses: it merges addresses heard in announces and from settings, drops its own, saves them in the data folder, loads them at start, and says which ones are not dialed yet. The Mesh asks it what to dial; nothing else knows how addresses are stored.
- **Dialing at run time.** A newly learned address gets a TCP client interface without restarting the Node. Reticulum 1.5.7 offers this only through a private function; the first ticket proves it on loopback before anything builds on it. If it fails, the fallback is decided then: the Node exits when its address list grows and the compose file's restart policy starts it again with the saved list.
- **Own address.** A Node learns the address other Nodes see it from by asking a reachable Node's HTTP API (a new endpoint answering with the caller's address). Docker's NAT makes this the laptop's hotspot address. The advertised port is the published TCP port. Both can be overridden by a setting. A Node that has no answer yet announces no address of its own and still dials.
- **Settings.** The existing `NODE_TCP_PEERS` stays the seed list (the Pi's address by default in the compose file). New settings only for the advertised address override. No setting for the cap.
- **Join flow in the container.** The join script waits and retries for the Hub's `/api/state` with a clear "waiting for the Hub at …" line instead of exiting, saves the Hub's identity in the data folder, and on later starts uses the saved identity at once (an explicit `HUB_IDENTITY` still wins). Sign-up and the printed accept line are unchanged.
- **Hub takeover.** Every Node saves the last Node registry and Shelter status it accepted from the Hub in its data folder. A Node started as the Hub with no registry or Shelter status file of its own seeds from those copies at a higher `ver` than it saw. Its identity comes from a copied Hub key file, so `HUB_IDENTITY` on every Node stays valid. The Event clock and the warning log are not carried over: the presenter restarts or jumps the Replay, and a Surge still holding warns again under a new id (as after any Hub restart). There is no automatic election, and two Hubs must never run at once; the runbook says to stop the old one first.
- **Image.** One image for every role, generalised from the 0069 image: builds the Node and the dashboard, data folder in a volume, nothing secret baked in. The Hub key is mounted, never copied into the image.
- **Compose.** A Sensor service with the small named set (Node name, town or latitude and longitude, Hub address, Hub identity override), publishing the HTTP and TCP ports, `restart: unless-stopped`; a Hub service under a profile for the standby; a documented host-network override for Linux Wi-Fi discovery. Any other `NODE_*` setting passes straight through.
- **Pi.** Stays native. It runs the Hub by default, listens for TCP on all addresses and announces its Dial address. The hotspot setup is unchanged.
- **Distribution.** Build from a clone (`docker compose up --build`) and a `docker save` tarball for this weekend; a public registry after the repo goes public, in a later ticket.
- **Glossary.** `CONTEXT.md` gains **Dial address** and **Hub takeover**. No ADR: the full mesh is easy to undo, and ADR 0002 still holds (the Hub is a Node on the Mesh, now one that can be replaced).

## Testing Decisions

- A good test checks what Nodes do from outside (who hears whom, what the API answers), not how a config file is written or how addresses are stored.
- **Seam A: real Reticulum Nodes over TCP on loopback.** Prior art: `test_reticulum_nodes.py` (and its private-port and stray-Node lessons). Cases: B and C each list only A and hear each other within a fixed time; A stops and B and C still hear each other; B restarts with A still down and reaches C from its saved addresses.
- **Seam B: `MeshedNodes` in memory for the Hub takeover.** Prior art: `test_node_registry.py`, `test_hub_remembers_shelter_status.py`. A Sensor that heard registry `ver` N and a Shelter status, started again as the Hub with no files of its own, announces both at a higher `ver` with the same Registered Nodes, and Flood Risk still counts them.
- **Unit tests only where Seam A cannot show the failure clearly:** the announce app data encoding (cap, bad or newer-version data ignored) and the own-address endpoint. `test_reticulum_config.py` covers any config change.
- **Seam C: the image and the script, by rehearsal.** On one laptop: a Hub and two containers from the compose file, the Hub stopped, readings still flowing between the containers; a container started before its Hub, then the Hub started. Then the manual check on the Pi: a laptop container on the Pi's hotspot, the Pi's Hub stopped, readings still flowing, and a Hub takeover from a standby laptop. Recorded in `docs/agents/lessons.md`, with anything not done on real devices listed as unproven.

## Out of Scope

- Readings history backfill for a Hub that comes back (a follow-up ticket); this spec keeps the live view only.
- Aggregating readings into a database such as TigerData (a future Hub-only feature).
- Automatic Hub election, or two Hubs at once.
- A Mesh that survives the Pi losing power: the hotspot goes with it.
- macOS and Windows hosts beyond what the image already does; they may work over the default TCP path but are not claimed.
- Publishing the image to a registry while the repo is private.

## Further Notes

- Proven 2026-10-18 on one laptop (throwaway script, not in the repo): three Nodes in `tcp` mode. With B and C dialing only A, B never heard C; with every Node listing every other, B and C kept hearing each other 30 s after A stopped, while A's age climbed.
- Proven the same day: a Docker container's published port on this Arch laptop (firewalld on, `wlan0` in the `public` zone) answered a phone on the same Wi-Fi with no firewall change. Laptop to laptop on the Pi's hotspot is not yet proven.
- Announce app data and Reticulum's MTU (500 bytes) bound the address list; the registry's one-packet limit already holds the demo to about 8 Registered Nodes, so the cap is not the tight one.
