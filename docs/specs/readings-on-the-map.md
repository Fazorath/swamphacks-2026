# Readings on the map

**Status:** ready-for-agent

Ticket: `docs/tickets/0005-readings-on-the-map.md`. Parent spec: `docs/specs/storm-shield.md`. Formats: `docs/specs/wire-formats.md`. Look: `docs/design/ui.md`. Words follow `CONTEXT.md`.

## Problem Statement

A resident opening the dashboard sees a plain list of readings. They cannot tell where each Node is, which readings are near them, how old a reading is, or that the numbers are simulated. The map is meant to be the page.

## Solution

The dashboard shows a Leaflet map of the neighborhood with one marker per Node at its Fuzzed Position. Each marker shows the Node's name and water level, says SIMULATED when the reading is a Simulated Reading, and greys out with STALE and its age once the Node has been silent for 15 seconds. Beside the map, the Readings rail lists every Node's latest Community Reading with the same tags. Selecting a marker highlights its card and selecting a card highlights its marker. No exact location is ever shown or shared.

## User Stories

1. As a resident, I want to see every Node on a map of my neighborhood, so that I know where conditions are being measured.
2. As a resident, I want each marker to show its water level, so that I can read the most important number without opening anything.
3. As a resident, I want each Node's other readings listed beside the map, so that I can see pressure, rain rate and soil moisture too.
4. As a resident, I want to tap a marker and see its card highlighted in the rail, so that I can find the full readings for that spot.
5. As a resident, I want to tap a card and see its marker highlighted, so that I can find where that reading comes from.
6. As a resident, I want a SIMULATED tag on simulated readings, so that I never mistake demo data for a real storm.
7. As a resident, I want to see how old each reading is, so that I know whether to trust it.
8. As a resident, I want a Node that has gone quiet greyed out with STALE and its age, so that old numbers are never read as current.
9. As a resident, I want Node positions shown only to about 200 m, so that neighbors' homes are not exposed.
10. As a Sensor Node operator, I want my configured location fuzzed before it is published, so that my exact home is never broadcast.
11. As a Sensor Node operator, I want to set my Node's location in its `.env`, so that my Node appears in the right part of the neighborhood.
12. As a demo presenter, I want each demo Node set to a different location, so that five Nodes on one table show as five markers.
13. As a resident, I want the map to open framed on the Nodes, so that I see them without panning.
14. As a resident, I want the map to stay where I put it once I pan or zoom, so that updates do not fight me.
15. As a resident, I want a sensible Gainesville view when no Nodes have reported yet, so that the map is never empty and lost.
16. As a resident, I want the map credit always visible, so that tile data is attributed correctly.
17. As a presenter, I want the Scenario Step and Reset controls to keep working, so that the demo is still driven the same way.
18. As a resident, I want my own Node labeled with its name and others with their short id, so that I can tell which marker is mine.

## Implementation Decisions

- **Fuzzing is already built (ticket 0003).** The Node snaps its configured location to a grid of about 0.002° before publishing, and only the snapped position travels the mesh. This ticket adds no new fuzzing code, only a test of the 200 m bound.
- **Node API: `age_s`.** Each entry in the readings list the dashboard polls gains `age_s`: seconds since this Node last accepted a reading from that sender, measured on this Node's own clock, never the sender's or the browser's. Ticket 0019 carries the field into `/api/state`.
- **Staleness threshold.** The dashboard treats a Node as Stale when `age_s` is over 15. The 60-second "stops counting" and 10-minute "removed" thresholds belong to ticket 0021.
- **Map component.** One `NodeMap` component built with `leaflet` and `react-leaflet`, using CARTO dark tiles fetched online, with the attribution always visible. Offline tiles are ticket 0025 and replace only the tile source.
- **Markers.** A neutral Community-cyan dot with a label of the Node's name and water level in centimetres (the API's unit). SIMULATED tag when the reading is simulated; greyed with STALE and the age when Stale. No popups. Flood Risk coloring arrives with ticket 0006.
- **Node names.** The label uses this Node's configured name for itself and the 12-character Node id for every other Node. Registry names arrive with ticket 0012.
- **Readings rail.** The existing readings list becomes a rail beside the map. Each Node is a card with all four readings, the SIMULATED tag and the STALE tag with the age. The Step and Reset buttons and the `n` and `r` shortcuts stay at the bottom of the rail, unchanged.
- **Selection.** One selected Node at a time, shared by map and rail: selecting a marker highlights its card and selecting a card highlights its marker. Selecting the selected Node again clears the selection. The marker label counts as part of the marker.
- **View.** Fit to all Nodes; Gainesville centre while empty. A Node hears itself before anyone else, so the view is re-framed as new Nodes appear, until the resident pans or zooms. After that it is never moved.
- **Pure mapping module.** A single function turns the polled readings plus this Node's name into marker data (label, water level, simulated, stale, age, position). The map and the rail both read it.
- **Configuration.** `.env.example` says each demo Node needs its own `NODE_LATITUDE` and `NODE_LONGITUDE`. No overlap handling for markers.
- **Glossary.** `CONTEXT.md` gained Fuzzed Position and notes where Stale ages are shown. No ADR.

## Testing Decisions

- A good test checks behaviour a resident or the other seam can see, not how the component is built.
- **Seam A (Node API, pytest):** a position another Node sees is never the exact configured location and stays within about 200 m of it; `age_s` follows the receiving Node's clock. Prior art: the fuzzing tests in the Node test suite and the shared-readings test with in-memory meshed Nodes.
- **Dashboard seam (Vitest + Testing Library):** the pure mapping function (label, water level, stale at 15 s, simulated), and the rail (cards show readings, SIMULATED and STALE tags, selecting a card marks it selected). Prior art: the existing dashboard `App` test.
- The Leaflet map is not rendered in jsdom and is not mocked; it is checked once by running the app and looking at it.

## Out of Scope

Flood Risk colors and the storm signal (0006), offline tiles and the Flood-Prone Area overlay (0025), registry names and Unverified greying (0012), `/api/state` (0019), silent-Node dropping (0021), the top bar, tabs and phone layout, camera tiles, and any tile error state.

## Further Notes

With no internet the tiles fail and the background goes blank until ticket 0025; markers and the rail still work, which is accepted for now. A Node set exactly on a grid point gets an unchanged position, which is harmless.
