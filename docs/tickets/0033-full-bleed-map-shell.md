# 0033: God's Eye View map shell on MapLibre

**What to build:** On a desktop the map fills the screen under a new top bar and above a status strip, drawn by MapLibre GL from vector data instead of Leaflet raster tiles, and the existing Readings, Evacuation Plan and Cameras Panels float over it as translucent glass. Everything the Leaflet map showed (Node markers at this ticket's plain level, Shelters, the Flood-Prone Area, the river, the Route, the home) is drawn again on the new map, so nothing is lost. The page reads as the map first, appears at once and never stutters.

**Blocked by:** 0032

**Status:** in-progress

**Owner:** Fazorath

**Assignee:** Fazorath

**Spec:** `docs/specs/gods-eye-view.md`

**Design:** `docs/design/ui.md` ("God's Eye View", "Layout", "Map"); decisions `docs/design/gods-eye-view-decisions.md` (D-01 to D-07, D-08, D-48 to D-51); canvas artboards `C-TopBar`, `C-StatusStrip`, `C-Panel`, `D-Normal`. Per `ui.md`, draw the God's Eye View artboard on the canvas first.

- [ ] The map is MapLibre GL, dark, drawn from layers in the theme's colour roles; it needs no run-time request to any host other than its own Node (a test fails on a CARTO or AWS request)
- [ ] Basemap look: Osiris lifted one step (ground `navy-900`, outside `navy-925`, labels `ink-300`; D-07) with lifted land (rivers `river-300`, border `ink-400`; D-01); district hairlines only past the national zoom (D-02); at the national zoom the place labels are Kathmandu and the four valley towns only, cities on zoom (D-04); hillshade faint, about 10% (D-05)
- [ ] The fleet's shrink between the valley and national zoom is interpolated with the zoom (radius and label visibility), with no popping; checked by hand on the demo laptop while zooming in and out, and noted here (owner's note on D-08; the marker work itself is 0035)
- [ ] Osiris's small terrain helpers are not part of this ticket (0067); if anything is ported from Osiris, its MIT notice is kept
- [ ] Leaflet and the CARTO tile path leave the map; Shelters, the Flood-Prone Area, the river line, the Route and the home still draw, and the Household and Evacuation Plan flows still pass
- [ ] The map fills the viewport between the top bar and the status strip; Panels are positioned over it: Readings docks left at 288 px; Alerts, the Evacuation Plan and Cameras stack right at 336 px, Cameras third (D-50; sizes before the 120% scale)
- [ ] Default open Panels: on a calm day Readings only, the Evacuation Plan Panel hidden; a warning or Alert opens Alerts and the Plan (D-50, D-51)
- [ ] Top bar, in order: logo, Event clock, Flood Risk chip, Online / Mesh-only pill, Hub button only on a Hub (D-48); the Node name moves to the status strip; the Storm Signal pill and the Household and Node buttons keep their places
- [ ] Status strip, in order: the Simulated badge first (0035 fills it), then freshness (age of the readings, Cache Pack version, cameras live or offline) and the Node name and role, the data credit with "Boundaries are indicative" at the right (D-49); says Mesh-only when it is
- [ ] Panels use the glass surface with a blur on desktop only; each has a collapse chevron and opens with the 180 ms slide
- [ ] The Household and Hub slide-overs keep working over the new shell
- [ ] Vitest flow tests: the Hub button is absent on a Sensor Node; collapsing a Panel hides its content; the map component runs against a mocked MapLibre map (jsdom has no WebGL)
- [ ] Performance bar: first map paint under 1 s on the demo laptop from a Node on the local network, 60 fps panning with a Panel open; checked by hand and noted here
- [ ] Animates only `transform` and `opacity`; a poll that changes nothing re-renders nothing
- [ ] The weather layer tickets (0054, 0055, 0059; 0056 and 0057 were dropped) now build on this map, so a note in 0054 says so
- [ ] All **Commands** pass
