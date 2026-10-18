# 0071: Rising-water sheet (stretch)

**What to build:** As the wave passes, a drawn water level climbs the valley walls on the 3D map beside the river, so the audience sees how fast and how high the water rises. It reads as a height line with tick marks, follows the Replay's reconstructed levels and is labelled `RECONSTRUCTION` on the water and in the status strip. Decisions D-46 and D-47 in `docs/design/gods-eye-view-decisions.md`.

**Blocked by:** 0065, 0067

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/gods-eye-view-decisions.md`; canvas artboards `G-Rising-Water`.

- [ ] The water level is a height line with tick marks: a dashed `river-300` line either side of the river at each reach's reconstructed level from the replay timeline, a tick every metre, no filled sheet (D-46); no new invented numbers
- [ ] The label `RECONSTRUCTION` sits on the water, following the head, and the status strip shows "Water level: RECONSTRUCTION" beside the Simulated badge while the line is drawn (D-47); the tone rules in `docs/specs/flash-flood-replay.md` hold: terrain and water level only, no houses, people or damage imagery
- [ ] It runs only while terrain is on; with 2D, the switch off or reduced motion, it is a static marked height instead
- [ ] Performance bar holds with it on; checked by hand and noted here
- [ ] All **Commands** pass
