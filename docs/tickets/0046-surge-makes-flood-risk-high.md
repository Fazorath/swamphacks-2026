# 0046: A Surge makes Flood Risk High

**What to build:** When a Node's water level jumps by at least a set amount within a short window, its Flood Risk goes High at once with the reason "water rose 3.2 m in 4 min", before any fixed level is reached. A slow rise still follows the existing rules.

**Blocked by:** None (can start immediately)

**Status:** done

**Owner:** refloow-0

**Spec:** `docs/specs/flash-flood-replay.md`

- [x] Surge rise and window are named constants beside the existing Flood Risk thresholds
- [x] Reason code `water_surge`; the dashboard sentence states the rise and how long it took
- [x] The Node API reports which Node surged, so the Hub can act on it (0013)
- [x] Seam A tests (with `MeshedNodes.hear_from`): a sudden rise is High with `water_surge`; the same rise spread over a long time is not a Surge; the Unverified Node case moved to 0061, which waits on 0012
- [x] All **Commands** pass (on Windows `test_reticulum_mesh.py` still fails its two file-permission tests, which assert a Unix mode; see `docs/agents/lessons.md`)

**Found while checking it on one laptop:** a full Replay can skip S0's Surge because the ramp is as short as the publish interval (0060). `surged` is "surging now" and not latched, so 0013 must remember it already warned.
