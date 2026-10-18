# God's Eye View

**Status:** ready-for-agent

Decision record: `docs/adr/0005-gods-eye-view-is-a-vector-map-and-the-fleet-is-display-data.md`. Parent specs: `docs/specs/flash-flood-replay.md`, `docs/specs/storm-shield.md`. Formats: `docs/specs/wire-formats.md`. Look: `docs/design/ui.md`. Words follow `CONTEXT.md`. Decided in a grill session on 2026-10-18.

## Problem Statement

The map is a Google-Maps-style raster map that stutters, with a handful of Nodes on it. It does not show what the project is: a network of Nodes along Nepal's rivers that sees a flood wave upstream and warns the towns below. Judges watching a projector see a small valley map and a list of readings, not a network, and the wave is a number in a sentence.

## Solution

On the desktop, projector and judge laptops, the dashboard becomes a God's Eye View: a dark, instant, labelled vector map of Nepal, in the style of Osiris, with a slight 3D terrain. About 40 simulated Nodes glow green along the country's rivers; the five valley Nodes and the real Nodes stand out. When the Replay's Surge hits, the map choreographs the warning (a band, a chime, the camera flying to the upstream Node) and a bright wave front runs down the Bhote Koshi and Trishuli at the replay speeds while the Wave ETA counts down. Other rivers flow slowly and dimly. A Node that stops publishing shows a contact-lost cue within about 5 s and fades to Stale at 15 s.

The phone layout stays as designed until it is tested on real phones (0036).

## User Stories

1. As a judge, I want to see a network of Nodes spread over Nepal, so that I understand the system is meant to be a country-wide mesh of small sensors.
2. As a judge, I want the map to appear at once and never stutter while I watch, so that nothing distracts from the story.
3. As a judge, I want the real Nodes marked and the simulated ones honestly labelled, so that I know what is live and what is not.
4. As a judge, I want to see one Node on the table react when the presenter presses a breadboard button, so that I can see a real sensor feeding the network.
5. As a judge, I want to see an audience laptop's Node drop off the map when its Wi-Fi is turned off and come back when it is turned on, so that I can see the Mesh is live.
6. As a judge, I want to see the flood wave run down the river and light each Node and town as it passes, so that I can read how far ahead a warning could be.
7. As a judge, I want the Wave ETA at the downstream town to count down over the map, so that the animation and the number agree.
8. As a resident or judge, I want a Community Warning to take over the screen with sound, so that I cannot miss it.
9. As a presenter, I want to hide the simulated fleet with one control, so that I can show only the real and valley Nodes.
10. As a presenter, I want a 2D / 3D switch, so that I can drop to flat if a projector laptop struggles.
11. As a resident, I want hand-placed high-ground points near each town with their climb above the river, so that "get to higher ground" has a place and a number.
12. As a reader of the repo, I want every map data source, licence and check date written down, so that the map can be trusted and reproduced.

## Implementation Decisions

### Map

- **MapLibre GL, vector data from the Cache Pack, no run-time tile requests, no CARTO key.** Layers: country border, districts, rivers (the main rivers named), places. Colours come from theme roles, matched to Osiris's Dark Matter look; the basemap is our own, not CARTO's style.
- **Sources, licences, credit shown on the map and in the README:** borders and districts from geoBoundaries (CC BY); rivers and places from OpenStreetMap (ODbL); elevation from SRTM. Borders are drawn as the dataset gives them, with "Boundaries are indicative" beside the credit.
- **Performance bar (acceptance on every map ticket):** on the demo laptop with the Node serving over the local network, first map paint under 1 s, 60 fps panning with terrain on and the fleet visible. If frame rate drops, terrain turns off by itself. Animate only `transform` and `opacity` for DOM markers; MapLibre layers for dots.
- **3D:** MapLibre terrain from elevation tiles in the Cache Pack, exaggerated about 1.5 times, pitch up to 60 degrees, flat and top-down on the national view, tilting over the valley (and when a warning flies the camera). A bottom-left 2D / 3D switch like Osiris's. No globe. Osiris's small terrain helpers (tile loader, terrain attach and detach, projection helper) are ported under their MIT notice, pointed at the pack; its map component is not copied and `stealthFetch` is never used.
- **Cache Pack v4:** Nepal vector bundle, elevation tiles (valley at about 30 m, a coarse national layer; target a few MB, measured by the build), river line and Shelters as before, and the fleet file. The Gainesville and v3 raster tiles leave the map's path.

### Nodes and the Simulated Fleet

- **Fleet file** in the Cache Pack: about 40 entries, each with name, position, River km where it sits on a river, and a track of Simulated Readings derived from real Open-Meteo weather for the Replay's window. Most hold calm, slowly drifting readings; two or three on other rivers rise without ever reaching a Surge; one goes Stale partway through. The five valley Nodes stay the only ones that drive the story.
- **The Hub serves the fleet in the state snapshot** as display entries, flagged as fleet. Fleet entries never reach the Mesh, Flood Risk, a Community Warning or the Node registry.
- **One quiet badge** in the status strip and a legend entry, "Simulated network · weather from Open-Meteo", with the sources in its tooltip. A card opened for a fleet Node carries `SIMULATED`. The presenter says it out loud.
- **Real Nodes carry a `REAL` ring**: the breadboard Pi (an extra Registered Node, driven by its buttons independently of the Replay), the Hub, and any audience laptop. The valley Sensors follow the Replay and read as Simulated Readings as before.
- **Audience Node:** a prepared laptop running `scripts/join-demo.sh <hub address>` with its own name and a position in a Nepal town, pre-accepted in the Hub registry (the registry fits about 8; the Hub, S0 to S3 and the Pi make 6). A volunteer turns its Wi-Fi off and on.

### Marker states

| State | Marker |
|---|---|
| Calm or Low (fleet or real) | Osiris-style green dot with glow and label. Green means healthy; the word `LOW` stays on the chip and card |
| Elevated | Amber dot and glow |
| High | Red dot, strongest glow |
| Contact lost (silent about 5 s) | Glow dies, a ring counts down to 15 s |
| Stale (15 s) | Desaturated muted grey with `STALE · age` |
| Unverified | Hollow dashed dot, `NOT COUNTED` |
| Real | The state's dot plus a `REAL` ring |
| Selected | 2 px cyan ring |

Contact lost is display only; Flood Risk, Surge and the 15 s and 60 s rules do not change. A Node that speaks again fades back in over 300 ms.

### The wave, the warning, the water

- **The wave front** runs along the valley river line at the replay's per-reach speeds on the Event clock (about 190, 68 and 18 km/h), a bright front with a fading trail that lights each Node and town as it passes. It uses the Wave ETA numbers so animation and countdown agree. Other rivers get slow, dim flow dashes, purely decorative.
- **Warning choreography on the God's Eye View:** a full-width band and the chime fire, the camera flies to the Surging Node, the wave starts, and the Wave ETA appears as a large countdown over the home town's marker. The map is never dimmed. The phone Warning Takeover is unchanged.
- **Rising-water sheet (stretch):** a drawn water level that climbs the valley walls as the wave passes, its height following the Replay's reconstructed levels, labelled `RECONSTRUCTION`. Terrain and water level only; no houses, people or damage imagery (tone rules in `docs/specs/flash-flood-replay.md`).

### High ground

- **Hand-placed points**, 1 or 2 each near Syabrubesi, Betrawati and Trishuli, with the height above the river read from the elevation data, a walking time uphill, a source note and a check date, like the placeholder Shelters. They draw as a marker with an arrow and "+90 m above the river, 11 min uphill". A computed version, or points submitted by trusted contributors and checked against elevation data, is a later idea and a pitch line only.

### Layout changes to `ui.md`

The Layer rail gains a Fleet toggle with a count. The Readings Panel lists the valley and real Nodes only (about 6 to 10 cards); clicking any dot opens its card. Its exact form is chosen from two or three drawn variants (0070).

## Testing Decisions

- MapLibre needs WebGL, which jsdom lacks: test the marker states and fleet logic as pure functions and the map component against a mocked map, as the Leaflet tests did.
- A check that no run-time request goes to another host while the map loads (no CARTO, no AWS).
- The performance bar is checked by hand on the demo laptop and noted in the ticket.
- Server side: the fleet never appears in the Mesh, Flood Risk or warnings (test with a Surging fleet entry).

## Out of Scope

- A globe view, satellite imagery, aircraft or ship layers, finance or AI features from Osiris.
- A phone redesign (0036 waits for testing on real phones).
- Real Nodes beyond the demo's; truly cold audience joins.
- Computed high ground and contributor-submitted points.

## Further Notes

- Tickets: 0033, 0035 (rewritten) and 0063 to 0071; see `docs/tickets/README.md`.
- Osiris: https://github.com/simplifaisoul/osiris (MIT). Keep its licence notice on anything ported.
