# 0046: A Surge makes Flood Risk High

**What to build:** When a Node's water level jumps by at least a set amount within a short window, its Flood Risk goes High at once with the reason "water rose 3.2 m in 4 min", before any fixed level is reached. A slow rise still follows the existing rules.

**Blocked by:** None (can start immediately)

**Status:** in-progress

**Owner:** refloow-0

**Spec:** `docs/specs/flash-flood-replay.md`

- [ ] Surge rise and window are named constants beside the existing Flood Risk thresholds
- [ ] Reason code `water_surge`; the dashboard sentence states the rise and how long it took
- [ ] The Node API reports which Node surged, so the Hub can act on it (0013)
- [ ] Seam A tests (with `MeshedNodes.hear_from`): a sudden rise is High with `water_surge`; the same rise spread over a long time is not a Surge; an Unverified Node's Surge does not count once 0012 lands
- [ ] All **Commands** pass
