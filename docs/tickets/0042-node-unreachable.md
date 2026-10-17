# 0042: Dashboard shows "Node unreachable"

**What to build:** When a Viewer's Node stops answering for 5 s, the dashboard says "Node unreachable" and stops showing anything live, so a frozen number is never mistaken for a current one. A Wi-Fi blip shorter than that does not trigger it. The map, the Cache Pack, the Household Profile, the last Official Alerts and the last open Shelters stay, so the resident can still plan where to go. The first answer after a gap restores everything.

**Blocked by:** 0041

**Status:** in-progress

**Owner:** leonardorofaDV

**Spec:** `docs/specs/node-unreachable.md` (parent: `docs/specs/state-snapshot.md`)

- [ ] Each poll keeps its 2 s timeout; a network error, a non-OK answer or a timeout is not a good answer
- [ ] After 5 s with no good answer (from the last one, or from page open) the dashboard shows the "Node unreachable" banner; before the first answer it shows "Connecting…" until then
- [ ] Shorter gaps, and failures broken by a good answer, leave the screen unchanged
- [ ] While unreachable: readings, Flood Risk, the Online / Mesh-only badge, camera tiles and the Event clock are cleared; camera and Event clock polling stop
- [ ] While unreachable: the map, Cache Pack content, Household Profile, the Node's name and role, the Hub button and Hub Panel, Official Alerts and the open-Shelter list stay
- [ ] While unreachable the Evacuation Plan says "Shelter status last confirmed N s ago; it may have changed since", ticking
- [ ] While unreachable the Hub Panel's Replay section shows "Waiting for the Hub to answer" and no buttons
- [ ] A failed `/api/shelters` poll keeps the last open list
- [ ] The next good answer clears the banner and the Shelter line, restores the data and resumes camera and Event clock polling
- [ ] The 0008 "no request carries the Household Profile" test also runs across an unreachable stretch
- [ ] `docs/specs/wire-formats.md` says "after 5 s with no good answer"; the group chat is told, because the file says changes need the whole team
- [ ] Vitest: the cases under "Testing Decisions" in the spec
- [ ] All **Commands** pass
