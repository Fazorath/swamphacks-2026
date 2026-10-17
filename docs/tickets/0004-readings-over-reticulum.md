# 0004: Readings over Reticulum

**What to build:** Two laptops on the same Wi-Fi each run a Node and see each other's Community Readings on their dashboards, carried by Reticulum with no internet and no addresses configured. This is the riskiest ticket in the project (ADR 0001); rehearse it on Saturday.

**Blocked by:** 0003, and the Community Reading format (decided, `docs/specs/wire-formats.md`)

**Status:** ready-for-agent (the code is done and merged; what is left needs the Raspberry Pis and two laptops, see "Handoff" at the bottom)

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] A Reticulum implementation of the Mesh interface (AutoInterface over the local Wi-Fi), chosen by config (built and proven on loopback and fixed TCP addresses; AutoInterface itself is untried until the Pis)
- [x] Each Node has a persistent Reticulum identity; incoming messages carry the verified sender identity
- [x] A Node's id (12 hex characters of that identity) is the sender id other Nodes and the API use; the operator's Node name is only a label, and until the registry (0012) the dashboard shows a remote Node by its id
- [x] Each Node keeps its Reticulum config and identity in its own gitignored folder (`NODE_DATA_DIR`, in `.env.example`), so a restart keeps the same id and Nodes never share Reticulum state
- [x] Reticulum is the default Mesh and the choice stays a setting, documented in `.env.example` so later work follows the same convention; tests ask for the in-memory Mesh explicitly
- [ ] Nodes find each other automatically on the same network
- [ ] Rehearsed on the Pi's own hotspot from the first run; if automatic discovery fails there, a documented fixed-address fallback to the Pi is added, and only then
- [ ] Manual check: two laptops on one Wi-Fi show each other's readings; turning one off leaves the other working
- [ ] Manual check: still works with the internet unplugged
- [x] Short setup and run notes for teammates, kept next to the code
- [x] Seam A tests still run on the in-memory Mesh and pass
- [x] All **Commands** pass

## Findings and open decisions (from grilling, before the spike)

Sources: the Reticulum manual pages "Understanding Reticulum" and "Interfaces".

- **Reticulum does not identify the sender of a data packet.** Single packets and Links offer initiator anonymity; only announces are signed. So a Node must sign its own Community Readings with its Reticulum identity, and the Mesh checks that signature against the public key it learned from that Node's announce. `docs/specs/wire-formats.md` said Reticulum provides this; a docs PR corrects it.
- **Size:** about 383 bytes fit one encrypted packet and about 465 one unencrypted packet. A 64-byte signature has to fit inside that along with the message.
- **Two Nodes on one laptop** probably collide on AutoInterface's UDP ports (29716 and 42671), so test with real machines.
- **Firewalls** on each laptop must allow those two UDP ports. The manual says nothing about Windows; confirm the laptops' operating systems.

Open decisions, with the recommended answer:

1. **Decided:** readings travel on one unencrypted broadcast destination, each reading signed (one hop, fine on one Wi-Fi). Encrypted packets to each known peer (multi-hop, a send per peer, cap near 315 bytes) were rejected because this is a demo and the demo does not need relaying. The Mesh module is the only code that knows about Reticulum, so moving to per-peer packets later changes that one module. The pitch says "peer to peer on one Wi-Fi, ready for radio later", not "multi-hop". If the unencrypted broadcast turns out not to reach every peer through AutoInterface, the spike will show it and per-peer packets become the fallback.
2. **Decided:** every reading is verified. A Node announces itself on start and every 10 s; receivers keep its public key and drop its readings until the announce has been heard. Verifying only the Hub's Community Warnings was rejected because the Hub's key is learned the same way, so the extra work is small.
3. **Decided:** Relay Node dropped from `CONTEXT.md` and the spec; nothing relays on one Wi-Fi, so the word comes back only when something does.
4. First step: a 20-minute spike on two real machines and the Pi hotspot (`pip install rns`, one message over AutoInterface) before building anything else.

## Progress (built without the Pis)

Built and tested on one Windows machine over a loopback Reticulum interface (`NODE_MESH_INTERFACE=loopback`); `node/README.md` has the run notes. A fixed-address interface (`NODE_MESH_INTERFACE=tcp`, for example over Tailscale, with every machine on the same tailnet) lets real machines on different networks exchange readings before the Pis arrive; it is also the fixed-address fallback if automatic discovery fails on the Pi hotspot. Still open, all needing the real hardware:

- AutoInterface discovery on two laptops and on the Pi hotspot (`NODE_MESH_INTERFACE=auto`, the default). The code path is the same; only the interface section of the generated Reticulum config differs.
- The internet-unplugged and firewall checks.

Spike findings:

- A hub-and-spoke layout does not carry broadcasts between clients: with one TCP server and two clients, each client heard only the server, with or without transport enabled on the server. AutoInterface is a full mesh (every Node talks to every discovered peer), so the demo is unaffected; the loopback stand-in dials every lower slot to match.
- rns 1.5.7 calls announce handlers with keyword arguments (`destination_hash`, `announced_identity`, `app_data`, `announce_packet_hash`).
- A signed reading is 244 bytes, inside the 464-byte unencrypted packet.

## Handoff: what is left, and why it needs the hardware

Written on 2026-10-17 when refloow-0 handed this ticket on. **The code is finished and merged.** The unticked boxes above are not unfinished work: they are checks that cannot be made without the real hardware, because the Raspberry Pis were not available when this was built. Everything below was proven on one Windows machine instead.

**What was proven without the Pis**

- Three real Node processes find each other, exchange signed Community Readings and survive one of them restarting, over a loopback Reticulum interface (`NODE_MESH_INTERFACE=loopback`) and over fixed TCP addresses (`NODE_MESH_INTERFACE=tcp`). `node/tests/test_reticulum_nodes.py` runs both.
- Signing, verification, the 12-character Node id and the persistent identity are covered by `test_reticulum_mesh.py` and `test_reticulum_config.py`.
- Only `AutoInterface` is untried. It is the default (`NODE_MESH_INTERFACE=auto`), and the code path is the same as the other two; only the interface section of the generated Reticulum config differs.

**What the next person does, in this order**

1. Two laptops on one Wi-Fi, `NODE_MESH_INTERFACE=auto`, each with its own `NODE_NAME` and `NODE_DATA_DIR` (run notes in `node/README.md`). Allow UDP 29716 and 42671 in each firewall; on Windows set the Wi-Fi profile to Private. Each dashboard should show the other's readings, labelled by Node id. Tick "Nodes find each other automatically".
2. Switch one off: the other must keep working. Tick the "two laptops" manual check.
3. Unplug the internet (keep the Wi-Fi router on) and repeat. Tick the "internet unplugged" check.
4. Repeat on the Pi's own hotspot from the first run. If discovery fails there, the fixed-address fallback already exists (`tcp` interface, peers listed in `NODE_TCP_PEERS`); document the Pi's address in `node/README.md` and tick the rehearsal box. Add a fallback only if it fails.
5. If the unencrypted broadcast does not reach every peer through AutoInterface, fall back to per-peer encrypted packets (decision 1 above). Only `reticulum_mesh.py` changes.

**Things to know**

- Two Nodes on one laptop probably collide on AutoInterface's UDP ports, so test AutoInterface on separate machines.
- `test_reticulum_nodes.py` uses fixed ports (HTTP 8101 to 8103, TCP 4250 to 4252 and 4350 to 4352). A Node left running from a rehearsal makes the `loopback` variant time out ("the Nodes did not reach the expected state in time") while `tcp` still passes. Stop stray Nodes before running it.
- Mark the ticket `done` only after the three manual checks pass on real hardware.

**Review notes (code review of 0004, 2026-10-17; nothing blocks the merge)**

- A message with an unknown `kind` is logged as a WARNING on every packet, but `docs/specs/wire-formats.md` says to ignore unknown kinds. Fix this before 0012 and 0013 put more message kinds on the same channel (ticket 0023 covers bad messages).
- `publish` raises `ValueError` for an oversize message. The tick loop catches it, but `POST /api/scenario/step` does not, so it would return a 500. A normal reading is 244 bytes, so this only matters if a message grows.
- Mesh packets arrive on a Reticulum thread and call `ReadingStore.record`; confirm the store is safe for that before the Pi rehearsal.
- `NODE_DATA_DIR` holds the Node's private key. Only `node/data/` is gitignored, so keep it there.
- A replay of the newest signed packet is accepted, and Node ids are 48 bits. Acceptable for a demo; say so if a judge asks.
