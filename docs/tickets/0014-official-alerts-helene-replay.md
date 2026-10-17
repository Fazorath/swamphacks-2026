# 0014: Official Alerts: Helene replay

**What to build:** The Hub replays the recorded Hurricane Helene NWS alerts and the Alachua County evacuation order, and every Node shows them over the mesh in a distinct Official Alerts panel labeled "OFFICIAL · REPLAY". A resident with a mobile-home Household Profile sees in their Evacuation Plan that the county order applies to them.

**Blocked by:** 0003, 0009, and the Official Alert message format in the UI design doc

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] Recorded Helene NWS alerts and the Alachua County order are stored as replay data, citing their source URLs
- [ ] Replay goes through the same normalization path that live feeds will use (0017); each alert is tagged with its source and live or replay
- [ ] The Hub forwards Official Alerts over Mesh; every Node's API and dashboard show them
- [ ] The panel style is clearly distinct from community information and shows "OFFICIAL · REPLAY" for replays
- [ ] The Evacuation Plan takes Official Alerts as input and lists orders that apply to the household (mobile home/RV; home in a Flood-Prone Area)
- [ ] Seam A tests: a replayed alert reaches every Node labeled as replay
- [ ] Seam B tests: a mobile-home profile matches the county order; a site-built home outside a Flood-Prone Area does not; with no Official Alert there is no evacuation language
- [ ] All **Commands** pass
