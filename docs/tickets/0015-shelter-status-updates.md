# 0015: Shelter status updates over the mesh

**What to build:** This is the umbrella; the work is split into 0027 to 0031 and this ticket is done when they have all merged. The Hub operator marks a Shelter open or closed. The change reaches every Node over the mesh, and residents' Evacuation Plans pick a different Shelter if theirs closes, all without internet and without downloading the Cache Pack again.

**Blocked by:** 0027, 0028, 0029, 0030, 0031 (0009 is done; the format is decided in `docs/specs/wire-formats.md`)

**Status:** done

**Owner:** Fazorath

**Spec:** `docs/specs/shelter-status.md` (parent: `docs/specs/storm-shield.md`)

- [x] The Hub can set a Shelter's status through its API and dashboard
- [x] Shelter status updates are sent over Mesh, signed by the Hub; Nodes keep the latest per Shelter
- [x] The dashboard and Evacuation Plan use the latest statuses on top of the Cache Pack
- [x] Seam A tests: a status set on the Hub shows up on every Node; one not signed by the Hub is ignored
- [x] All **Commands** pass
