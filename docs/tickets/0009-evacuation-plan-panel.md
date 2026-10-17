# 0009: Evacuation Plan panel

**What to build:** A resident with a Household Profile sees an Evacuation Plan panel, with no internet. It shows their Flood Risk and its reasons, whether their home is in a Flood-Prone Area, and the nearest open Shelter that fits their needs. Together with 0004, this completes the cut line.

**Blocked by:** 0006, 0007, 0008

**Status:** done

**Owner:** Fazorath

**Spec:** `docs/specs/storm-shield.md`

- [x] The Evacuation Plan is a pure function in the dashboard: saved Household Profile + Cache Pack + open Shelter ids + Flood Risk → plan (seam B). Official Alerts join it in 0014 and routes in 0010; the function takes neither yet
- [x] **Flood Risk** in the plan is the Mesh-wide headline level with its reasons, not a level tied to the home. When the level is `null` the risk section is omitted
- [x] **No saved profile:** the plan shows the Flood Risk headline (if any) and a prompt to set the Household Profile; no Flood-Prone Area or Shelter lines
- [x] **No valid Cache Pack on the Node yet:** the plan shows Flood Risk (if any) and "Shelter and flood-area information is still loading on this Node. Follow official sources."
- [x] **Flood-Prone Area:** inside says "Your home is inside a mapped Flood-Prone Area."; outside says "Your home is outside the mapped Flood-Prone Areas (FEMA zones and creek floodplains, approximate)."
- [x] **Shelter:** the nearest open Shelter by straight-line distance, shown as a distance ("1.8 km away"), never a drive time. A need is a filter, not a restriction: special-needs and pet-friendly are required only when the household needs them, otherwise any open Shelter qualifies
- [x] **No Shelter listed open:** "No open Shelter announced yet. Follow official sources." Open Shelters exist but none fit: "No open Shelter matches this household" plus the official-sources pointer; partial matches are never offered
- [x] The plan contains no evacuation instruction of Storm Shield's own: one fixed line, "Evacuation decisions come from official sources.", always shows, and no other sentence uses an instruction verb (a seam B test checks this)
- [x] Each Node serves a read-only open-Shelter list, `GET` returning `{"open": [...]}` like the wire-format `shelters` message, seeded at startup with every Shelter in that Node's own Cache Pack as open. This is a demo placeholder until 0015 adds the Hub operator toggle and mesh propagation; 0019 folds it into `/api/state`. Record it in `docs/agents/lessons.md`
- [x] The panel renders the plan and marks only the chosen Shelter on the map, styled apart from the Home marker; the marker clears when the plan has no Shelter. Every other Shelter and the flood overlay stay in 0025
- [x] Seam B tests: closed Shelters are skipped; special-needs and pet requirements pick the right Shelter, and a household with no needs can get a flagged Shelter; a home inside a Flood-Prone Area is flagged and one outside is not; a `null` level, no profile and no pack each render the cases above
- [x] Node test (seam A): the open-Shelter list holds every pack Shelter at startup
- [x] Manual cut-line check: one Node → dashboard over the mesh → unplug internet → readings keep updating → the Evacuation Plan renders on a phone. Rehearsed on one laptop: a Hub and a Sensor over loopback (readings and Shelters survive the pack source going away), with the dashboard opened on a real phone over Tailscale. Not proven on Raspberry Pis or over Wi-Fi discovery between devices
- [x] All **Commands** pass
