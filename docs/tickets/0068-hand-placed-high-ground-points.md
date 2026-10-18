# 0068: Hand-placed high-ground points

**What to build:** Near Syabrubesi, Betrawati and Trishuli the Cache Pack carries one or two hand-placed high-ground points each. They stay hidden on a calm day; when the Evacuation Plan says "get to higher ground", they appear as chevron-up pins with a line such as "90 m up · 11 min walk", the nearest one highlighted. Decisions D-43 to D-45 in `docs/design/gods-eye-view-decisions.md`.

**Blocked by:** 0035, 0063

**Status:** in-progress

**Owner:** leonardorofaDV

**Assignee:** refloow-0

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/gods-eye-view-decisions.md`; canvas artboards `G-High-Ground`.

- [ ] A high-ground file in the Cache Pack: for each point, name, position, height above the river read from the elevation data, walking time uphill (the Evacuation Plan's detour factor and speed), a source note and a check date; the points are placeholders until someone checks them against the terrain
- [ ] The map draws each point as a chevron-up pin, a rounded triangle with an up arrow outlined in `ink-50`, smaller than a Shelter pin so the two are never confused (D-43, D-45), with the line "90 m up · 11 min walk" (D-44); the points are never inside the Flood-Prone Area
- [ ] The points are hidden on a calm day and appear only with the "No Shelter you can reach in time" plan (D-45); then the plan names the nearest high-ground point and the map highlights it with a cyan outline (D-43)
- [ ] A test checks the climb line from fixed numbers and that a point inside the Flood-Prone Area is refused by the build
- [ ] A later idea, not built here: points submitted by trusted contributors and checked against elevation data
- [ ] `scripts/check.sh` passes
