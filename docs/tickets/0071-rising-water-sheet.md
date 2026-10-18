# 0071: Rising-water sheet (stretch)

**What to build:** As the wave passes, a drawn water level climbs the valley walls on the 3D map beside the river, so the audience sees how fast and how high the water rises. It follows the Replay's reconstructed levels and is labelled `RECONSTRUCTION`.

**Blocked by:** 0065, 0067

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

- [ ] An extruded river-corridor layer whose height follows each reach's reconstructed water level from the replay timeline; no new invented numbers
- [ ] The label `RECONSTRUCTION` sits beside it, and the tone rules in `docs/specs/flash-flood-replay.md` hold: terrain and water level only, no houses, people or damage imagery
- [ ] It runs only while terrain is on; with 2D, the switch off or reduced motion, it is a static marked height instead
- [ ] Performance bar holds with it on; checked by hand and noted here
- [ ] All **Commands** pass
