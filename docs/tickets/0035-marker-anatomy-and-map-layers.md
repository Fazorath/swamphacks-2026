# 0035: Marker anatomy and map layers

**What to build:** Every Node, Shelter, Home and Route on the map is drawn the way the design shows it: Node markers with glow, outlined dot and label that update in place, and the map layers in their own styles. A resident reads the whole neighborhood from the map alone.

**Blocked by:** 0033, 0025

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

**Design:** `docs/design/ui.md` ("Map"); canvas artboards `C-Markers`, `C-Tags`, `D-Elevated`, `D-Storm`, `D-StaleUnverified`.

- [ ] Node markers follow the table in "Map": no Flood Risk, Low / Elevated / High, Unverified (hollow dashed, `NOT COUNTED`), Stale (`STALE · age`), Selected (cyan ring)
- [ ] A marker updates in place on a poll and is never rebuilt; a Node pulses once when its Flood Risk rises
- [ ] Selecting a marker highlights its Node card and the other way round; no popups
- [ ] Flood-Prone Areas use the blue-grey diagonal hatch; open Shelters a solid pin, closed Shelters a hollow grey pin with `CLOSED`, the nearest open Shelter for the household a cyan ring with its name always shown
- [ ] Home is a cyan house icon; the Route is a 5 px cyan line with a dark casing
- [ ] The Storm Signal darkens the map's edges statically, with no animated weather
- [ ] Unverified and Stale states need the Node Registry (0012) and silent-Node rules (0021); until they land, tests build those states from fixtures
- [ ] The layer buttons from 0034 show and hide each layer
- [ ] Vitest tests: each marker state renders its label and class; a poll with no change leaves the marker objects untouched
- [ ] 60 fps panning with Panels open on a mid-range phone, checked by hand and noted in the ticket
- [ ] All **Commands** pass
