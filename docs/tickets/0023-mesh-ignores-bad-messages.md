# 0023: The Mesh ignores messages it cannot use

**What to build:** `docs/specs/wire-formats.md` says receivers ignore unknown `kind` values and unknown fields so a newer Node never crashes an older one. The in-memory Mesh only ever carries one message type, so nothing checks this yet, and one failing listener would stop delivery to every other Node. Do it on the real Reticulum Mesh, where messages really arrive from outside.

**Blocked by:** 0004

**Status:** done

**Owner:** Fazorath

**Spec:** `docs/specs/storm-shield.md`

- [x] A message with an unknown `kind` is dropped without an error reaching any Node
- [x] A message with extra fields is accepted and the extras are ignored
- [x] A message with a format version `v` this Node does not know is dropped the same way as an unknown `kind`
- [x] A message that fails to parse is dropped and logged, and the Mesh keeps delivering later messages
- [x] One listener raising does not stop the other listeners or other Nodes from receiving the message
- [x] Tests cover each case through the Node API on both the in-memory and the Reticulum Mesh
- [x] All **Commands** pass

**Note:** the in-memory cases run through Node APIs (`MeshedNodes.send_bytes`). The Reticulum cases run through `verify` on signed packets and the shared `deliver_to_listeners`, not through two live Reticulum Nodes with a hand-made bad packet.
