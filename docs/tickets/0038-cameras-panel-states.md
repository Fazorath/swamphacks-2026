# 0038: Cameras Panel states

**What to build:** The Cameras Panel is a 2×2 grid of 16:9 tiles that says plainly what each camera is doing: live with its age, offline because the internet is down, or unavailable because that one camera failed. When the Node drops to Mesh-only the tiles dim and relabel in place.

**Blocked by:** 0033

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/online-status-and-cameras.md`

**Design:** `docs/design/ui.md` ("Cameras Panel"); canvas artboards `C-Cameras`, `D-MeshOnly`, `P-MeshOnly`.

- [ ] Live tile: the picture, a LIVE dot and "updated 40 s ago"; a new picture cross-fades in over 300 ms
- [ ] Offline tile (Node is Mesh-only): dashed muted frame, camera-off icon, `OFFLINE · internet down`, no picture
- [ ] Unavailable tile (one camera failed while Online): solid frame, alert icon, `UNAVAILABLE`; never mistaken for Offline
- [ ] Going Online to Mesh-only dims and relabels the tiles in place, without rebuilding them
- [ ] The Cameras rail button from 0034 counts live cameras and the status strip says cameras live or offline
- [ ] Vitest tests: each of the three states renders its label; a Mesh-only Node shows no picture request
- [ ] All **Commands** pass
