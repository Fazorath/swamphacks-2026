# Design canvas

Plain HTML artboards (`<Prefix>-<Name>.dc.html`), listed in `canvas.json` and styled by `theme.css` (a copy of `dashboard/src/theme.css` plus the component classes the boards share). Open any board in a browser; the canvas tool lays them out by `canvas.json`. Prefixes: `F-` foundations, `C-` components, `D-` desktop views, `P-` phone views, `Flow-` flows, `G-` the God's Eye View (decisions `D-01` to `D-55` in `docs/design/gods-eye-view-decisions.md`).

## God's Eye View boards (`G-`)

| Board | Shows | Decisions |
|---|---|---|
| `G-National-Calm` | Whole-Nepal view, calm, fleet as 5 px dots, valley and real Nodes labelled, river ladder, legend and 2D / 3D switch | D-01 to D-11, D-34, D-36, D-39 to D-41, D-48, D-49 |
| `G-Valley-3D` | The valley tilted 45°, exaggeration 1.5×, height bands, district hairlines | D-02, D-05, D-08, D-10, D-30 to D-33 |
| `G-Warning-Moment` | 08:44:20: band, comet with its 15 km trail, Timure flashed, S0 contact lost, Alerts Panel with Acknowledge, corner card; inset of the 08:37 "wave started" beat | D-16 to D-19, D-21 to D-28, D-51, D-55 |
| `G-Warning-Acknowledged` | 08:46: chip beside Flood Risk, band gone, Alerts and Plan open, corner card still there | D-18, D-24, D-25, D-27, D-29, D-50 |
| `G-Contact-Lost-Stale` | The audience laptop dropping off the map, the arc at 5 / 10 / 14 s, Stale at 15 s, heard again | D-14, D-15, D-52 |
| `G-Fleet-Popover` | A fleet Node opened from the map at the city zoom, the sources tooltip on the badge | D-09, D-38, D-40, D-42 |
| `G-High-Ground` | Chevron-up pins beside Shelter pins at Syabrubesi, with the "higher ground" plan | D-43 to D-45 |
| `G-Rising-Water` | Height line with tick marks, RECONSTRUCTION on the water and in the strip (stretch) | D-46, D-47 |
| `G-Marker-Anatomy` | Every marker state at the valley and national zoom, the zoom-interpolated shrink | D-06, D-08 to D-15, D-52, D-53 |
| `G-ETA-Corner-Card` | Three treatments of the Wave ETA corner card, four states each; owner to pick (0072) | D-24, D-25, D-54 |
| `G-Readings-Ladder` | Readings Panel variant C at full height in three states | D-36 to D-38 |
| `G-Wave-Arrival` | Four frames of Syabrubesi as the wave passes | D-16 to D-18, D-21 |

Open on these boards, drawn as labelled options rather than decided: the Wave ETA treatment (A, B or C on `G-ETA-Corner-Card`), and whether the 2D / 3D switch sits above the legend (D-34, drawn) or below it (D-39, the "Option B" note on `G-National-Calm`).

## Geometry on the `G-` boards

The map art is real geometry, not a sketch. Every path was projected and simplified by a throw-away script (not in the repo: about 400 lines of Python, no dependencies; it downloads the sources below into an empty folder, projects, simplifies with Douglas–Peucker to about 0.6 px, and writes the SVG path strings the boards embed). Checked 2026-10-18.

| Layer | Source | Licence | Notes |
|---|---|---|---|
| Nepal border, districts | geoBoundaries gbOpen NPL ADM0 and ADM2, release 9469f09 (simplified GeoJSON) | CC BY 4.0 | Drawn as the dataset gives them; "Boundaries indicative" sits in the legend |
| Mahakali/Sharda, Karnali, Narayani/Kali Gandaki, Koshi/Sun Koshi, Trishuli, Bhote Koshi and the named tributaries | OpenStreetMap `waterway=river` ways by name, through Overpass (`overpass-api.de`) | ODbL | 452 ways, about 75 000 nodes before simplification; the Sindhupalchok Bhote Koshi is left out, the Rasuwa one kept |
| The valley river line (Lhende Khola to below Trishuli) | `scripts/cache-pack/river.source.geojson` (OSM through `scripts/derive_river.py`) | ODbL | River km from the file; the comet's position is read along it |
| Valley towns and Node positions | `docs/specs/flash-flood-replay.md` Node table; Kathmandu and Pokhara from OSM place nodes | ODbL | The breadboard Pi has no position in any spec; it is drawn at Kathmandu as a placeholder |
| Fleet dots (40) | `scripts/cache-pack/fleet.source.json` | — | Display data, illustrative. For the drawing each dot was snapped to the nearest fetched river vertex when that was within 10 km; 11 (mostly headwater lakes and towns on rivers not fetched) are drawn where the file puts them |
| Shelters, example home | `scripts/cache-pack/shelters.source.json`, the spec's example home | — | High-ground points are placeholders until 0068 |
| Terrain (3D boards) | Terrarium (SRTM) z12 tiles from AWS Terrain Tiles, sampled on a 150 × 140 grid (about 460 m) over 27.78–28.45 N, 84.95–85.65 E, contoured at 500 m steps (250 m on `G-Rising-Water`), smoothed, lifted by 1.5× | Terrain Tiles attribution; elevation approximate | A drawn approximation of the relief, not survey data; sampled: Syabrubesi about 1 540 m at S2, Timure 1 815, Betrawati 634, Trishuli 542, S0 2 719 |

Projections: flat boards are Web Mercator (EPSG:3857) scaled linearly to the artboard (national 124 px per degree, centre 83.45 E 28.42 N; crops at 400, 1 400, 2 600 and 9 000 px per degree). Tilted boards use a local tangent plane in km under a pinhole camera pitched 45° from vertical (valley: 60 km from the target at 85.26 E 28.13 N, focal 740 px; gorge: 16 km, focal 820 px).

Honest limits: the fleet positions in `fleet.source.json` were typed from memory and 11 of them do not sit on a fetched river; the Pi's position is invented; the hypsometric steps are coarse at the gorge zoom; river labels are placed on the widest on-screen way of each river, which is why MAHAKALI and KARNALI can hide under the Readings Panel.
