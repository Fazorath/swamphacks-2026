# 0027: Mesh carries a second message kind (Shelter status)

**What to build:** A Hub-signed Shelter status message travels over the Mesh and reaches other Nodes with the sender already verified, on both the in-memory and the Reticulum Mesh. A Node learns who the Hub is from `HUB_IDENTITY` and ignores Shelter status signed by anyone else. This is the prefactor for 0015: nothing the resident sees changes yet. Keep the change to `sign`, `verify` and the packet handler in the Reticulum Mesh, because 0004 is still being worked in that module; land it on `main` quickly.

**Blocked by:** None (can start immediately)

**Status:** in-progress

**Owner:** Fazorath

**Spec:** `docs/specs/shelter-status.md`

- [ ] The Mesh interface publishes and delivers a Shelter status message (`kind: "shelters"`, format in `docs/specs/wire-formats.md`) next to Community Readings; unknown kinds are still ignored
- [ ] The in-memory Mesh and the Reticulum Mesh both carry it, signed by the sender and checked before it reaches any listener
- [ ] `HUB_IDENTITY` is a setting, documented in `.env.example` with a blank value and a note that a wrong or missing one means the Node shows nothing open
- [ ] Seam A tests: a Shelter status signed by the configured Hub identity is delivered; one signed by any other Node is ignored; Community Readings still flow as before
- [ ] All **Commands** pass (Pi or two-laptop discovery stays unproven; rehearse on loopback and say so)
