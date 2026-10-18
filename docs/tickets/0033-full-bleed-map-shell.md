# 0033: God's Eye View map shell on MapLibre

**What to build:** On a desktop the map fills the screen under a new top bar and above a status strip, drawn by MapLibre GL from vector data instead of Leaflet raster tiles, and the existing Readings, Evacuation Plan and Cameras Panels float over it as translucent glass. Everything the Leaflet map showed (Node markers at this ticket's plain level, Shelters, the Flood-Prone Area, the river, the Route, the home) is drawn again on the new map, so nothing is lost. The page reads as the map first, appears at once and never stutters.

**Blocked by:** 0032

**Status:** in-progress

**Owner:** Fazorath

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/ui.md` ("God's Eye View", "Layout", "Map"); canvas artboards `C-TopBar`, `C-StatusStrip`, `C-Panel`, `D-Normal`. Per `ui.md`, draw the God's Eye View artboard on the canvas first.

- [ ] The map is MapLibre GL, dark, drawn from layers in the theme's colour roles; it needs no run-time request to any host other than its own Node (a test fails on a CARTO or AWS request)
- [ ] Osiris's small terrain helpers are not part of this ticket (0067); if anything is ported from Osiris, its MIT notice is kept
- [ ] Leaflet and the CARTO tile path leave the map; Shelters, the Flood-Prone Area, the river line, the Route and the home still draw, and the Household and Evacuation Plan flows still pass
- [ ] The map fills the viewport between the top bar and the status strip; Panels are positioned over it (Readings docks left at 288 px, Evacuation Plan and Cameras stack right at 336 px, sizes before the 120% scale)
- [ ] Top bar: logo, Node name and role, Flood Risk chip, Storm Signal pill when on, Online / Mesh-only pill, Household button, Hub button only on a Hub
- [ ] Status strip: age of the readings, Cache Pack version, cameras live or offline; says Mesh-only when it is; the data credit and "Boundaries are indicative"
- [ ] Panels use the glass surface with a blur on desktop only; each has a collapse chevron and opens with the 180 ms slide
- [ ] The Household and Hub slide-overs keep working over the new shell
- [ ] Vitest flow tests: the Hub button is absent on a Sensor Node; collapsing a Panel hides its content; the map component runs against a mocked MapLibre map (jsdom has no WebGL)
- [ ] Performance bar: first map paint under 1 s on the demo laptop from a Node on the local network, 60 fps panning with a Panel open; checked by hand and noted here
- [ ] Animates only `transform` and `opacity`; a poll that changes nothing re-renders nothing
- [ ] The weather layer tickets (0054 to 0057) now build on this map, so a note in 0054 says so
- [ ] All **Commands** pass
