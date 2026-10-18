# 0064: Simulated Fleet file and Hub state

**What to build:** The Cache Pack carries a fleet file of about 40 Nodes along Nepal's rivers, each with a track of Simulated Readings derived from real Open-Meteo weather for the Replay's window, and the Hub serves them in the state snapshot as display entries. They follow the Event clock. They never touch the Mesh, Flood Risk, a Community Warning or the Node registry.

**Blocked by:** 0063

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** refloow-0

**Spec:** `docs/specs/gods-eye-view.md`

- [ ] A fleet file in the pack: about 40 entries with name, position and River km where the Node sits on a river; positions spread along Nepal's main rivers and readable on a map (no stacks)
- [ ] Tracks come from the Open-Meteo data the pack already holds (0052), rescaled to believable river levels; most are calm and drift slowly, two or three on other rivers rise without reaching a Surge, one goes silent partway so it turns Stale; the file notes its sources
- [ ] `/api/state` lists fleet entries flagged as fleet, with the reading for the current Event clock; with no Replay running they show their calm start
- [ ] A test with a Surging fleet entry shows no `water_surge` reason, no High, no Community Warning and nothing on the Mesh; a fleet entry cannot be Registered
- [ ] The state snapshot test lists the new fields (`test_state_snapshot.py` changes)
- [ ] `scripts/check.sh` passes
