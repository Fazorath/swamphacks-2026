# 0004: Readings over Reticulum

**What to build:** Two laptops on the same Wi-Fi each run a Node and see each other's Community Readings on their dashboards, carried by Reticulum with no internet and no addresses configured. This is the riskiest ticket in the project (ADR 0001); rehearse it on Saturday.

**Blocked by:** 0003, and the Community Reading format (decided, `docs/specs/wire-formats.md`)

**Status:** in-progress

**Owner:** refloow-0

**Spec:** `docs/specs/storm-shield.md`

- [ ] A Reticulum implementation of the Mesh interface (AutoInterface over the local Wi-Fi), chosen by config
- [ ] Each Node has a persistent Reticulum identity; incoming messages carry the verified sender identity
- [ ] A Node's id (12 hex characters of that identity) is the sender id other Nodes and the API use; the operator's Node name is only a label, and until the registry (0012) the dashboard shows a remote Node by its id
- [ ] Each Node keeps its Reticulum config and identity in its own gitignored folder (`NODE_DATA_DIR`, in `.env.example`), so a restart keeps the same id and Nodes never share Reticulum state
- [ ] Reticulum is the default Mesh and the choice stays a setting, documented in `.env.example` so later work follows the same convention; tests ask for the in-memory Mesh explicitly
- [ ] Nodes find each other automatically on the same network
- [ ] Rehearsed on the Pi's own hotspot from the first run; if automatic discovery fails there, a documented fixed-address fallback to the Pi is added, and only then
- [ ] Manual check: two laptops on one Wi-Fi show each other's readings; turning one off leaves the other working
- [ ] Manual check: still works with the internet unplugged
- [ ] Short setup and run notes for teammates, kept next to the code
- [ ] Seam A tests still run on the in-memory Mesh and pass
- [ ] All **Commands** pass

## Findings and open decisions (from grilling, before the spike)

Sources: the Reticulum manual pages "Understanding Reticulum" and "Interfaces".

- **Reticulum does not identify the sender of a data packet.** Single packets and Links offer initiator anonymity; only announces are signed. So a Node must sign its own Community Readings with its Reticulum identity, and the Mesh checks that signature against the public key it learned from that Node's announce. `docs/specs/wire-formats.md` said Reticulum provides this; a docs PR corrects it.
- **Size:** about 383 bytes fit one encrypted packet and about 465 one unencrypted packet. A 64-byte signature has to fit inside that along with the message.
- **Two Nodes on one laptop** probably collide on AutoInterface's UDP ports (29716 and 42671), so test with real machines.
- **Firewalls** on each laptop must allow those two UDP ports. The manual says nothing about Windows; confirm the laptops' operating systems.

Open decisions, with the recommended answer:

1. How readings travel: one unencrypted broadcast destination with each reading signed (one hop, fine on one Wi-Fi) versus encrypted packets to each known peer (multi-hop, a send per peer, cap near 315 bytes). Recommended: the broadcast destination.
2. A reading from a Node whose announce has not been heard yet: drop it until the announce arrives (announce on start and every 10 s). Recommended: drop.
3. Relay Node: nothing relays on one Wi-Fi, so drop the word from `CONTEXT.md` until something does. Recommended: drop.
4. First step: a 20-minute spike on two real machines and the Pi hotspot (`pip install rns`, one message over AutoInterface) before building anything else.
