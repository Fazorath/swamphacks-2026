# 0014: Official Alerts: DHM replay

**What to build:** The Hub replays the DHM alerts of 26 August 2026 on the Event clock, and every Node shows them over the mesh in a distinct Official Alerts panel labelled "OFFICIAL · REPLAY". A lead-time line compares the first Community Warning with the first Official Alert ("Community Warning 08:37 · first official SMS 09:15"). A resident whose home is in the Flood-Prone Area sees that the riverbank alert applies to them.

**Blocked by:** 0003, 0009, 0044, and the Official Alert format (decided, `docs/specs/wire-formats.md`; new sources proposed there)

**Status:** done

**Owner:** Fazorath

**Spec:** `docs/specs/flash-flood-replay.md` (replaces the Helene replay in `docs/specs/storm-shield.md`)

**Design:** `docs/design/ui.md` ("Alerts Panel"); canvas artboards `C-Alerts`, `P-Alerts`.

- [x] The DHM alerts (09:05 notice, 09:15 SMS to riverbank residents of Rasuwa, Nuwakot, Dhading and Chitwan, 10:28 Galchhi / Muglin / Prithvi Highway warnings) are stored in the replay timeline with their source URLs and real times
- [x] Each alert appears when the Event clock reaches its time, tagged with its source (`dhm`, `ndrrma`, `district`) and replay
- [x] The Hub forwards Official Alerts over Mesh; every Node's API and dashboard show them
- [x] The panel style is clearly distinct from community information and shows "OFFICIAL · REPLAY"
- [x] The lead-time line appears once both a Community Warning and an Official Alert exist
  - Built and tested (`leadTimeLine`, compared with the first Official Alert, 09:05, decided 2026-10-17), but `App` passes no Community Warning time until 0013 exists, so it does not show yet. 0013 wires `firstCommunityWarningAt`.
- [x] The Evacuation Plan lists alerts that apply to the household (`flood_prone_area` for riverbank residents)
- [x] Seam A tests: a replayed alert reaches every Node labelled replay, at its event time and not before
- [x] Seam B tests: a home in the Flood-Prone Area matches the riverbank alert; one outside does not; with no Official Alert there is no evacuation language
- [x] All **Commands** pass
