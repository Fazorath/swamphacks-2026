# 0023: The Mesh ignores messages it cannot use

**What to build:** `docs/specs/wire-formats.md` says receivers ignore unknown `kind` values and unknown fields so a newer Node never crashes an older one. The in-memory Mesh only ever carries one message type, so nothing checks this yet, and one failing listener would stop delivery to every other Node. Do it on the real Reticulum Mesh, where messages really arrive from outside.

**Blocked by:** 0004

**Status:** in-progress

**Owner:** Fazorath

**Spec:** `docs/specs/storm-shield.md`

- [ ] A message with an unknown `kind` is dropped without an error reaching any Node
- [ ] A message with extra fields is accepted and the extras are ignored
- [ ] A message with a format version `v` this Node does not know is dropped the same way as an unknown `kind`
- [ ] A message that fails to parse is dropped and logged, and the Mesh keeps delivering later messages
- [ ] One listener raising does not stop the other listeners or other Nodes from receiving the message
- [ ] Tests cover each case through the Node API on both the in-memory and the Reticulum Mesh
- [ ] All **Commands** pass
