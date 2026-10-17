# 0042: Dashboard shows "Node unreachable"

**What to build:** When a Viewer's Node stops answering, the dashboard says "Node unreachable" and stops showing anything live, so a frozen number is never mistaken for a current one. A brief Wi-Fi blip does not trigger it. The map, the Cache Pack and the Household Profile stay, so the resident can still plan where to go. The first answer after a gap restores everything.

**Blocked by:** 0041

**Status:** in-progress

**Owner:** leonardorofaDV

**Spec:** `docs/specs/state-snapshot.md`

- [ ] Each poll has a 2 s timeout; a network error, a non-OK answer or a timeout counts as a failure
- [ ] After 3 failures in a row the dashboard shows "Node unreachable" and clears readings, Flood Risk, online status and the camera tiles; camera polling stops
- [ ] One or two failures leave the screen unchanged
- [ ] The map, Cache Pack content, Shelters and Household Profile stay visible while unreachable
- [ ] The next good answer clears the message, restores the data and resumes camera polling
- [ ] The 0008 "no request carries the Household Profile" test runs several real poll cycles
- [ ] The "Node HTTP API" section of `docs/specs/wire-formats.md` describes `/api/state` as built (`id`, per-Node readings, Flood Risk) and the removed endpoints; the group chat is told, because the file says changes need the whole team
- [ ] Vitest: a fake `/api/state` that starts failing shows the unreachable state on the third failure and recovers on the next success
- [ ] All **Commands** pass
