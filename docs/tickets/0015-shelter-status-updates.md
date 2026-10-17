# 0015: Shelter status updates over the mesh

**What to build:** The Hub operator marks a Shelter open or closed. The change reaches every Node over the mesh, and residents' Evacuation Plans pick a different Shelter if theirs closes, all without internet and without downloading the Cache Pack again.

**Blocked by:** 0009, and the Shelter status format (decided, `docs/specs/wire-formats.md`)

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] The Hub can set a Shelter's status through its API and dashboard
- [ ] Shelter status updates are sent over Mesh, signed by the Hub; Nodes keep the latest per Shelter
- [ ] The dashboard and Evacuation Plan use the latest statuses on top of the Cache Pack
- [ ] Seam A tests: a status set on the Hub shows up on every Node; one not signed by the Hub is ignored
- [ ] All **Commands** pass
