# 0080: High-warning pager and the out-of-reach Shelter

**What to build:** A resident with a saved household hears a sharp pager tone and sees a banner the moment any Node within 60 km of home newly reaches a High warning, so the warning is not missed in a corner of the screen. And when a warning is up and no Shelter can be reached 5 minutes before the wave, the map still points somewhere: the closest Shelter outside the Flood-Prone Area, drawn dashed with "Can't reach in time: head uphill toward it", with a dashed line from home. Both came out of running the demo with a household at Syabrubesi.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** refloow-0

**Spec:** `docs/specs/flash-flood-replay.md`

- [x] `usePager(nodes, home)` returns an alert when a Node within `PAGER_RADIUS_KM` (60) of the saved home newly reaches High, and plays the pager tone: two harsh square-wave tones alternating in three bursts, about 4 s, never looping
- [x] A Node already High when the page first lists Nodes does not page; a Node that stays High pages once; after Dismiss the same Node reaching High again pages again; Elevated Nodes, High Nodes beyond the radius, and a page with no saved household stay silent
- [x] A red banner names the Node and its distance ("N km from your home") until dismissed; the sound waits for the page's first tap, as browsers require, and logs a warning when it cannot play
- [x] With a Wave ETA and no Shelter reachable in time, the plan also returns `outOfReachShelter`: the closest fitting Shelter outside the Flood-Prone Area. It is never the chosen Shelter, has no road route, and its name always shows on the map
- [x] The map draws it as a dashed marker labelled "Can't reach in time: head uphill toward it" and a dashed straight line from home (a direction, not a route); the plan text and "Get to higher ground" line are unchanged
- [x] Tests: the pager's trigger rules and radius (`usePager.test.tsx`, sound mocked), the out-of-reach choice and the flood-prone skip (`evacuationPlan.test.ts`), the marker and line on the map (`waveEtaFlow.test.tsx`); `scripts/check.sh dashboard` passes
- [ ] Not built, on purpose: a "Test pager" button, a radius setting, paging on Community Warnings (Surges) rather than a Node's own High level, and a real high-ground target near Trishuli (0068)

## Notes

- The pager reads each Node's own warning level from the Hub's Flood Risk (`level` on the Node), not the Community Warning. In the Replay, S0 reaches High about 3 s after the Collapse jump and S1 about 12 s later; S0 is about 25 km from Syabrubesi.
- The old design of the pager (page when the closest Node goes quiet) was tried first and dropped: in the Replay the Syabrubesi Sensor only goes silent at 08:50, a minute after "Surge reaches Syabrubesi", and a jump keeps a paused clock paused, so nothing ever fired.
- Not heard on real speakers or a phone yet; the tests mock the sound.
