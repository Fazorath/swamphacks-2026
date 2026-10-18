# 0048: Evacuation Plan picks a Shelter or higher ground

**What to build:** With a Community Warning in effect, the Evacuation Plan points to the nearest open Shelter the resident can walk to before the wave, with distance, walking time and height above the river. If none can be reached in time, it says "No Shelter you can reach in time. Get to higher ground, away from the river, now."

**Blocked by:** 0047

**Status:** done

**Owner:** leonardorofaDV

**Spec:** `docs/specs/flash-flood-replay.md`

**Design:** `docs/design/ui.md` ("Evacuation Plan Panel")

- [x] A Shelter is reachable if it is outside the Flood-Prone Area and its walking time (straight line × 1.4 at 4 km/h) is under the ETA minus 5 min; margin, factor and speed are named constants
- [x] One line explains the choice ("12 min walk, wave in 43 min" or "nearest Shelter 14 min walk, wave in 9 min")
- [x] Higher-ground advice never mentions basements or going towards the river, and the plan still points to official sources
- [x] With no warning the plan shows the nearest open Shelter as before
- [x] Seam B tests: a reachable Shelter beats a nearer one inside the Flood-Prone Area; higher ground when walking time plus margin exceeds the ETA; closed Shelters skipped; no evacuation order language
- [ ] Manual check (not done; needs the replay running with two phones): a phone with a profile at Syabrubesi shows higher ground and one at Betrawati shows a Shelter (rehearsal, not a Pi check)
- [x] All **Commands** pass
