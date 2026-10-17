# 0009: Evacuation Plan panel

**What to build:** A resident with a Household Profile sees an Evacuation Plan panel, with no internet. It shows their Flood Risk and its reasons, whether their home is in a Flood-Prone Area, and the nearest open Shelter that fits their needs. Together with 0004, this completes the cut line.

**Blocked by:** 0006, 0007, 0008

**Status:** in-progress

**Owner:** refloow-0

**Spec:** `docs/specs/storm-shield.md`

- [ ] The Evacuation Plan is a pure function in the dashboard: Household Profile + Cache Pack + Shelter statuses + Flood Risk → plan (seam B). Official Alerts join it in 0014
- [ ] The plan includes Flood Risk with reasons, whether the home is in a Flood-Prone Area, and the nearest open Shelter matching special-needs and pet requirements
- [ ] The plan contains no evacuation instruction of Storm Shield's own
- [ ] The panel renders the plan and highlights the Shelter on the map
- [ ] Seam B tests: closed Shelters are skipped; special-needs and pet requirements pick the right Shelter; a home inside a Flood-Prone Area is flagged and one outside is not
- [ ] Manual cut-line check: one Node → dashboard over the mesh → unplug internet → readings keep updating → the Evacuation Plan renders on a phone
- [ ] All **Commands** pass
