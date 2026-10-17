# 0021: Silent Nodes stop counting and drop off

**What to build:** A Node that goes quiet stops affecting anything and eventually disappears from the screen, following the Timing table in `docs/specs/wire-formats.md`. Today a Node that leaves (a closed laptop) keeps its last readings on every other Node forever, and a Node removed from the in-memory Mesh can still publish to the others. 0019 adds the 15-second stale flag; this ticket adds the other two steps and makes leaving real.

**Blocked by:** 0019

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] A Node silent for 60 s is reported as not counting; the field is in the state snapshot, ready for Flood Risk (0006) and Community Warnings (0013) to read
- [ ] A Node silent for 10 min is removed from the readings the snapshot lists
- [ ] The 15 s, 60 s and 10 min values live in one place, with the stale value from 0019
- [ ] A Node that has left the in-memory Mesh can no longer publish to the others
- [ ] Joining the in-memory Mesh under a name that is already taken fails loudly instead of replacing the earlier Node
- [ ] Seam A tests with a controllable clock: a Node that published and then left shows stale, then not counting, then gone, while the others keep working
- [ ] All **Commands** pass
