# 0038: Cameras Panel with the replay camera

**What to build:** The Cameras Panel shows the Hub's camera at Betrawati playing a recorded clip of the flood in step with the Event clock, labelled "CAMERA · REPLAY 09:18 NPT". It says plainly what the camera is doing: playing, offline because the Node is Mesh-only, or unavailable because the clip is missing. When the Node drops to Mesh-only the tile dims and relabels in place.

**Blocked by:** 0033, 0044

**Status:** done

**Owner:** leonardorofaDV

**Assignee:** Fazorath

**Spec:** `docs/specs/flash-flood-replay.md` (replaces the FL511 source in `docs/specs/online-status-and-cameras.md`)

**Design:** `docs/design/ui.md` ("Cameras Panel"); canvas artboards `C-Cameras`, `D-MeshOnly`, `P-MeshOnly`.

- [x] The FL511 camera list and picture fetching are removed
- [x] The Hub serves the clip from a gitignored folder on the demo laptop if present, otherwise from a committed Creative Commons clip; the README credits the fallback and says where the stage clip goes
- [x] The clip's position follows the Event clock (pauses, jumps and resets with it); the tile shows `CAMERA · REPLAY` and the event time
- [x] Offline tile (Node is Mesh-only): dashed muted frame, camera-off icon, `OFFLINE · internet down`, no picture
- [x] Unavailable tile (no clip found): solid frame, alert icon, `UNAVAILABLE`; never mistaken for Offline
- [x] Going Online to Mesh-only dims and relabels the tile in place, without rebuilding it
- [x] The Cameras rail button from 0034 counts cameras playing
- [x] Vitest tests: each state renders its label; the clip time follows the Event clock; a Mesh-only Node requests no clip
- [x] All **Commands** pass
