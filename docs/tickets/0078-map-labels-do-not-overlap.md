# 0078: Map labels do not overlap over the valley

**What to build:** Over the valley the Shelter labels, place labels and Node labels pile on top of each other and cannot be read (seen on the owner's screenshot of 0033: "Shree Komin Primary School", "Buddhist gompa above Syabrubesi" and the Syabrubesi label sit on one spot, and the three Shelters at Betrawati stack). The map keeps every label readable at the valley zoom.

**Blocked by:** None (can start immediately)

**Status:** done

**Owner:** Fazorath

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/ui.md` ("Map"); decisions `docs/design/gods-eye-view-decisions.md` (D-04, D-09); canvas artboard `G-Valley-3D`.

- [x] At the valley zoom on the real `cache-pack-v5`, no two labels cover each other: a Shelter label, a place label and a Node label that would collide are placed apart or the less important one is hidden (key places and the REAL Nodes win; a Shelter label shows in full on hover or when its Shelter is the plan's choice)
- [x] The placement is decided in one place and is a pure function of the labels' positions and sizes, so it is tested without a map
- [x] Labels do not flicker while panning or zooming (a label keeps its side until it has to move)
- [x] A Shelter with the plan's choice is always labelled
- [x] Vitest tests: two labels at one spot leave one shown or both apart; the key place and the chosen Shelter are never the one hidden
- [ ] Checked by hand over the valley on the demo laptop, with a screenshot noted here NOT DONE: the Chrome extension was not connected; run the hand check on the demo laptop before presenting.
- [x] All **Commands** pass

**Notes:** found in the 0033 review screenshot. Place names, Shelter labels and Node labels are DOM markers (`MapMarker`), so collision handling works on screen rectangles, not on MapLibre text layers.
