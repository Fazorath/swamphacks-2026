# 0004: Readings over Reticulum

**What to build:** Two laptops on the same Wi-Fi each run a Node and see each other's Community Readings on their dashboards, carried by Reticulum with no internet and no addresses configured. This is the riskiest ticket in the project (ADR 0001); rehearse it on Saturday.

**Blocked by:** 0003, and the Community Reading format (decided, `docs/specs/wire-formats.md`)

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [x] A Reticulum implementation of the Mesh interface (AutoInterface over the local Wi-Fi), chosen by config
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
- [ ] All **Commands** pass

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
