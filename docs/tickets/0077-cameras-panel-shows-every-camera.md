# 0077: The Cameras Panel shows every camera, live or clip

**What to build:** The Cameras Panel lists one tile per camera. A live camera shows its latest picture; a clip camera plays its five-minute clip in step with the Event clock, lined up so the flood in the clip lands when the wave reaches that camera's site. Each tile says whether it is live or a replay, credits its footage, and goes Offline at the internet cue.

**Blocked by:** 0038, 0075, 0076

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** Fazorath

**Spec:** `docs/specs/flash-flood-replay.md` ("Cameras")

**Design:** `docs/design/ui.md` ("Cameras Panel"); canvas artboards `C-Cameras`, `D-MeshOnly`, `P-MeshOnly`.

- [ ] One tile per camera from `GET /api/cameras`; a live tile reads `LIVE` with the picture's age, a clip tile reads `CAMERA · REPLAY` with the event time, and the two are never styled alike
- [ ] A clip tile shows its credit line and the words "illustrative footage"; it never says the footage was filmed at its Node site
- [ ] A clip's position is `(Event time - Event start) / rate - (wave arrival - flood_onset_s)`, clamped to the clip; it pauses, jumps and resets with the Event clock, and it never loops visibly. Before its onset it shows the calm part, after the clip ends it holds the last frame
- [ ] Each camera's wave arrival is the one the dashboard already works out for its Node site (0047); a site with no arrival plays its clip from the start
- [ ] At the internet cue every tile goes Offline in place (dashed muted frame, camera-off icon, `OFFLINE · internet down`, no request for a picture or a clip); when the Node is back Online they resume
- [ ] An Unavailable tile (clip missing, or the Viewer is on a Sensor Node) shows `UNAVAILABLE` and never looks like Offline
- [ ] Playback is muted, `playsInline` and starts without a tap; a clip that cannot start shows its poster and `TAP TO PLAY`
- [ ] The Cameras rail button counts cameras live or playing
- [ ] Vitest tests: each state's label; a clip's time follows the fake Event clock, including a jump and a reset; the onset lines up with a given wave arrival; a Mesh-only Node requests no clip; a live tile and a clip tile differ
- [ ] Checked by hand: the extreme-case clip (0076 clip 2) plays through a full Replay on the demo laptop (MacBook Pro, Apple M2, 8 GB, Chrome) with the 3D map open and two tiles playing; record dropped frames or CPU and note them here and in `docs/agents/lessons.md`. Also played once on a phone over Tailscale. Never reported as a check on a Pi
- [ ] All **Commands** pass

**Notes:** 0038 builds the Hub's one tile and the Offline and Unavailable states; this ticket extends it to the list and to the timing rule, so claim it after 0038 is merged.
