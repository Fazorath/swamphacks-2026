# God's Eye View

**Status:** ready-for-agent

Decision record: `docs/adr/0005-gods-eye-view-is-a-vector-map-and-the-fleet-is-display-data.md`. Parent specs: `docs/specs/flash-flood-replay.md`, `docs/specs/storm-shield.md`. Formats: `docs/specs/wire-formats.md`. Look: `docs/design/ui.md`. Visual decisions D-01 to D-55: `docs/design/gods-eye-view-decisions.md` (final; tickets cite them). Words follow `CONTEXT.md`. Decided in a grill session on 2026-10-18; the visual decisions were taken on the design board the same day and folded in here, replacing the earlier text where they differ.

## Problem Statement

The map is a Google-Maps-style raster map that stutters, with a handful of Nodes on it. It does not show what the project is: a network of Nodes along Nepal's rivers that sees a flood wave upstream and warns the towns below. Judges watching a projector see a small valley map and a list of readings, not a network, and the wave is a number in a sentence.

## Solution

On the desktop, projector and judge laptops, the dashboard becomes a God's Eye View: a dark, instant, labelled vector map of Nepal, in the style of Osiris lifted one step for the projector, with a slight 3D terrain. About 40 simulated Nodes sit green along the country's rivers; the five valley Nodes and the real Nodes stand out, and only an Elevated or High Node glows. When the Replay's Surge hits, the map choreographs the warning (a band, a chime, the camera flying to the upstream Node) and a white wave front runs down the Bhote Koshi and Trishuli at the replay speeds while the Wave ETA counts down in a corner card. Other rivers flow slowly and dimly. A Node that stops publishing shows a contact-lost cue within about 5 s and fades to Stale at 15 s.

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

- **MapLibre GL, vector data from the Cache Pack, no run-time tile requests, no CARTO key.** Layers: country border, districts, rivers, places. Colours come from theme roles; the basemap is our own, not CARTO's style.
- **Basemap look (D-01 to D-07):** Osiris's Dark Matter look lifted one step for projector washout (ground `navy-900`, outside `navy-925`, labels `ink-300`; D-07) with lifted land (land two steps up, rivers in `river-300`, border in `ink-400`; D-01). District lines show only past the national zoom, as faint hairlines over the valley (D-02). Rivers follow OpenStreetMap waterway geometry, never a hand-drawn line; the four main rivers (Mahakali, Karnali, Gandaki, Koshi) and the Bhote Koshi–Trishuli carry their names (D-03; the board's drawing was schematic and is not a source). At the national zoom the only place labels are Kathmandu and the four valley towns (Timure, Syabrubesi, Betrawati, Trishuli); cities appear on zoom (D-04). Hillshade on the valley walls is faint, about 10% (D-05). Healthy dots are flat; only Elevated and High glow (D-06).
- **Sources, licences, credit shown on the map and in the README:** borders and districts from geoBoundaries (CC BY); rivers and places from OpenStreetMap (ODbL); elevation from SRTM (Terrain Tiles attribution). Borders are drawn as the dataset gives them, with "Boundaries are indicative" beside the credit, and elevation is marked approximate.
- **Performance bar (acceptance on every map ticket):** on the demo laptop with the Node serving over the local network, first map paint under 1 s, 60 fps panning with terrain on and the fleet visible. If frame rate drops, terrain turns off by itself. Animate only `transform` and `opacity` for DOM markers; MapLibre layers for dots.
- **3D (D-30 to D-35):** MapLibre terrain from elevation tiles in the Cache Pack, exaggerated 1.5 times (D-31), pitch 45 degrees over the valley (D-30), the valley walls shaded by height bands (hypsometric tint: the ground lightens with elevation in two or three steps; D-32). The national view is flat and top-down, and manual zooming stays flat: the map tilts only when the warning flies the camera (and from a Valley button; D-33). 3D is the default wherever the pack has elevation tiles. A segmented 2D | 3D switch sits bottom-left, above the legend (D-34); the automatic drop to 2D on frame-rate loss is a safety net, never the normal state (owner, 2026-10-18; measured on the demo laptop in 0067), and when it fires the status strip says so in one line, "Terrain off · frame rate", and nothing else moves (D-35). No globe. Osiris's small terrain helpers (tile loader, terrain attach and detach, projection helper) are ported under their MIT notice, pointed at the pack; its map component is not copied and `stealthFetch` is never used.
- **Legend:** bottom-left in a small glass box beside the rail's foot, with the 2D / 3D switch as its last row (D-39, D-34): green dot, REAL ring, Stale grey, wave white and the Simulated badge.
- **Cache Pack v4:** Nepal vector bundle, elevation tiles (valley at about 30 m, a coarse national layer; target a few MB, measured by the build), river line and Shelters as before, and the fleet file. The Gainesville and v3 raster tiles leave the map's path.

### Nodes and the Simulated Fleet

> The Simulated Fleet was deleted (issue #29, ADR 0006). Everywhere in this spec, read the fleet, the Fleet toggle, the fleet file and the badge as history.

- **Fleet file** in the Cache Pack: about 40 entries, each with an id (`fleet-<slug>`), a name, the river it sits on (a name, never a River km), a `site` (`town` or `headwater`) and a position, plus a track of Simulated Readings for the Replay's window. Positions come from a hand-written `scripts/cache-pack/fleet.source.json` that cites where each came from: about 30 town sites at population centres along the main rivers and tributaries, and about 10 headwater sites at glacial lake outlets, glacier fronts and upper valleys (Tsho Rolpa, Imja Tsho, Thulagi, Lower Barun, Dig Tsho…). No two sites sit within 15 km of each other, and none sits on the Bhote Koshi–Trishuli or in the Langtang Khola catchment: the five valley Nodes alone tell the Replay's story. Positions are typed as given, not snapped to 0063's river line; 0035 checks on the map that they sit on their rivers.
- **Tracks are built from real weather**: the build asks the Open-Meteo archive for every fleet position in one request (as 0052 does for the valley) and writes a point every 30 event seconds. Rain, soil moisture and pressure are Open-Meteo's values. The water level is modelled: a calm base plus a gain times the rain of the previous 24 hours, and the file says so ("water level modelled from Open-Meteo rainfall"). Headwater sites always hold calm, slowly drifting tracks. The two or three town sites with the most real rain are the risers, given a larger gain so the rise shows, and stay below the Surge size and the High threshold. One town site goes silent at about 09:40, after the warning choreography. If no fleet position had enough rain for a visible rise, the build fails rather than inventing one.
- **Headwater sites show where a nationwide network would put its first Nodes** (each card: "upstream site · would warn the towns below"). They never warn. The lead-time claim rests on S0, the Replay's Headwater Node, alone (Surge 08:37, first Official Alert 09:05); the presenter's line is "S0 is one of these. Here is what one did in the real flood."
- **Every Node that holds the pack serves the fleet in the state snapshot**, from its own copy and its own Event clock, in a top-level `fleet` array apart from `nodes` (`docs/specs/wire-formats.md`). With no Replay heard, the entries show their calm start; a pack without a fleet file gives `fleet: []` and the badge hides. An entry's age is the real time since the last track point it passed, so the silent one shows the contact-lost cue at about 5 s and turns Stale at 15 s like any Node. Fleet entries never reach the Mesh, Flood Risk, a Community Warning or the Node registry.
- **One quiet badge** in the status strip (first thing in it, D-49) and in the legend, reading "40 simulated Nodes · 6 real" with the counts live from the fleet file and the registry (D-40; it replaces the earlier wording "Simulated network · weather from Open-Meteo"). The sources (geoBoundaries CC BY, OpenStreetMap ODbL, SRTM, Open-Meteo, with check dates) are in its hover tooltip (D-42). The Fleet toggle is a rail button with the count as its badge, no legend switch (D-41). A fleet Node opened from the map gets a popover beside its dot, not a card (D-38). The presenter says it out loud.
- **Real Nodes carry a `REAL` ring**: a 1.5 px white (`ink-50`) ring outside the dot and the word REAL under the label (D-10): the breadboard Pi (an extra Registered Node, driven by its buttons independently of the Replay), the Hub, and any audience laptop. The valley Sensors follow the Replay and read as Simulated Readings as before.
- **Audience Node:** a prepared laptop running `scripts/join-demo.sh <hub address>` with its own name and a position in a Nepal town, pre-accepted in the Hub registry (the registry fits about 8; the Hub, S0 to S3 and the Pi make 6). A volunteer turns its Wi-Fi off and on.

### Marker states

Dots are large for the valley and real Nodes: a 10 px dot with a 22 px glow radius at High (D-08). Labels (name and water level) are always on for the valley and real Nodes; fleet dots are labelled only on hover or when zoomed in (D-09). At the national zoom the fleet shrinks to 5 px points with no labels while the valley group keeps its size and labels (D-11); the shrink is interpolated with the zoom, never a jump (owner's note on D-08).

| State | Marker |
|---|---|
| Calm or Low (fleet or real) | Flat green dot with the dark outline and (valley and real) its label; no glow (D-06). Green means healthy (`green-400`, D-53); the word `LOW` stays on the chip and card |
| Elevated | Amber dot, 16 px glow (D-12) |
| High | Red dot, 22 px glow (D-12) |
| Flood Risk rises | A ring expands once from the dot and the Node card's 600 ms flash starts on the same frame (D-13); never continuous |
| Contact lost (silent about 5 s) | Glow dies; a grey arc around the dot drains from full to empty over the 10 s to Stale (D-14), with `CONTACT LOST` under the label, a small pulse and a status-strip note "name: contact lost 6 s" (D-52) |
| Stale (15 s) | Desaturated muted grey, no glow, the last water level struck through, `STALE · age` (D-15) |
| Unverified | Hollow dashed dot, `NOT COUNTED` |
| Real | The state's dot plus a 1.5 px white ring and the `REAL` tag (D-10) |
| Selected | 2 px cyan ring |
| Wave passes | The dot goes wave-white for about 2 event minutes, then follows its real state (D-18) |

Contact lost is display only; Flood Risk, Surge and the 15 s and 60 s rules do not change. A Node that speaks again fades back in over 300 ms and the strip says "heard again" (D-52).

### The wave, the warning, the water

- **The wave front** runs along the valley river line at the replay's per-reach speeds on the Event clock (about 190, 68 and 18 km/h). It is a white (`ink-50`, D-19) comet: a bright head with a soft glow and a trail that fades over the last 15 km behind it (D-16, D-17). Each Node it passes flashes white once and settles back to its real state (D-18); at each town the place label turns wave-white and the arrival time appears beside it and stays (D-21). It uses the Wave ETA numbers so animation and countdown agree. Other rivers get slow, dim drifting dashes, purely decorative (D-20).
- **Warning choreography on the God's Eye View (D-22 to D-29, D-55):** the "wave started" beat is the origin Node flashing red with its ring, the band sliding in and the chime (D-28). The band sits at the top, 120 px tall, with a 12% violet tint and the dashed violet edge (D-22, D-23), carrying the tag, the warning sentence and the fixed "check official sources" line; its border pulses twice over 3 s in time with the two notes (D-55). The camera flies flat to the Surging Node, then the pitch eases to the valley over 1.5 s (D-26). The Wave ETA is a corner card, bottom-right beside the Panels, with the number at 120 px and the town as its label, made to read as critical danger (D-24; it replaces the earlier "large over the home town's marker"); the number is white, amber under 15 min and red under 5, "wave expected now" in red (D-25, D-54). Acknowledge lives in the Alerts Panel only, so the band has no button and stays until the card is acknowledged (D-27); after that a violet dashed chip "WARNING · 35 MIN" beside the Flood Risk chip reopens the card, and there is no banner (D-29). The map is never dimmed. The phone Warning Takeover is unchanged.
- **Rising-water sheet (stretch):** the water level reads as a height line with tick marks, a dashed `river-300` line either side of the river at the reconstructed level with a tick every metre (D-46), climbing as the wave passes. `RECONSTRUCTION` sits both on the water and as a status-strip line "Water level: RECONSTRUCTION" beside the Simulated badge (D-47). Terrain and water level only; no houses, people or damage imagery (tone rules in `docs/specs/flash-flood-replay.md`).

### High ground

- **Hand-placed points**, 1 or 2 each near Syabrubesi, Betrawati and Trishuli, with the height above the river read from the elevation data, a walking time uphill, a source note and a check date, like the placeholder Shelters. They draw as a chevron-up pin, a rounded triangle with an up arrow outlined in `ink-50`, smaller than a Shelter pin (D-43, D-45), labelled "90 m up · 11 min walk" (D-44; replaces "+90 m above the river, 11 min uphill"). They are hidden on a calm day and appear, the nearest one highlighted with a cyan outline, only when the Evacuation Plan says "No Shelter you can reach in time. Get to higher ground" (D-45). A computed version, or points submitted by trusted contributors and checked against elevation data, is a later idea and a pitch line only.
- **Decided in the 0068 grill (2026-10-18).** Words: **High-ground point** (`CONTEXT.md`).
  - *File.* The Cache Pack carries `high_ground.json`; a pack without it shows no pins and no error. Per point: id, name, position, town, climb above the river, `walk_minutes` from the town, a source note and a check date. The climb is read by the build from the pack's elevation tiles (point minus the nearest river vertex), never typed.
  - *Build refuses* a point inside the Flood-Prone Area or within 100 m of it, a climb under 50 m, or no town within 2 km. The points are PLACEHOLDERs chosen from the elevation tiles: two at Syabrubesi, one each at Betrawati and Trishuli.
  - *Walking time.* One formula (straight line x 1.4 at 4 km/h, the plan's). The file's `walk_minutes` is from the town's key place; with a home, the map label and the plan use the walk from home instead.
  - *When shown.* Only in the plan state "No Shelter you can reach in time": a Wave ETA for the home and no Reachable Shelter, re-judged every second. The nearest point by straight line from home is outlined cyan and named in the plan. If it is more than 2 km from home, no pins show and the generic line stays. Whether the walk beats the wave is not checked; the line shows "wave in N min".
  - *Not done here.* No `cache-pack-v6` Release and no `run-demo.sh` change: the pins reach the demo when someone rebuilds and re-points it.

### Layout changes to `ui.md`

- **Top bar (D-48):** logo, Event clock, Flood Risk chip, Online / Mesh-only pill, Hub button. The Event clock takes the Node name's place on the left; the Node name moves to the status strip. After an acknowledged warning the violet chip sits beside the Flood Risk chip (D-29).
- **Status strip (D-49):** the Simulated badge first, then freshness per source (readings, Official Alerts, Cache Pack version) and the Node name, the data credit at the right. The strip also carries the contact-lost note (D-52), the terrain-off line (D-35) and the RECONSTRUCTION line (D-47).
- **Panels (D-50, D-51):** Readings docks left; Alerts and the Evacuation Plan stack right. On a calm day only Readings is open; the Evacuation Plan Panel stays hidden until a warning, when Alerts and the Plan open (replaces `ui.md`'s calm default of Readings and Plan).
- **Layer rail:** gains the Fleet toggle, a rail button with the count as its badge (D-41).
- **Readings Panel (D-36 to D-38, ticket 0070):** variant C, a river ladder by River km: the valley Nodes in river order on a vertical river line, the wave's position marked between them, and the real Nodes off the river listed under it. The breadboard Pi's card is pinned at the top with a cyan `LIVE SENSORS` tag. A fleet Node clicked on the map opens a popover beside its dot and leaves the Panel untouched.

## Testing Decisions

- MapLibre needs WebGL, which jsdom lacks: test the marker states and fleet logic as pure functions and the map component against a mocked map, as the Leaflet tests did.
- A check that no run-time request goes to another host while the map loads (no CARTO, no AWS).
- The performance bar is checked by hand on the demo laptop and noted in the ticket.
- High ground: the build's refusals and the climb from fixed elevation numbers (Node seam, pytest); the climb line, the "only with no Reachable Shelter" rule, the 2 km limit and the highlight as pure functions and a flow test against the mocked map (dashboard seam, Vitest).
- Server side: the fleet never appears in the Mesh, Flood Risk or warnings (test with a Surging fleet entry).

## Out of Scope

- A globe view, satellite imagery, aircraft or ship layers, finance or AI features from Osiris.
- A phone redesign (0036 waits for testing on real phones).
- Real Nodes beyond the demo's; truly cold audience joins.
- Computed high ground and contributor-submitted points.

## Further Notes

- Tickets: 0033, 0035 (rewritten), 0063 to 0071 and 0072 (the Wave ETA corner card); see `docs/tickets/README.md`.
- Osiris: https://github.com/simplifaisoul/osiris (MIT). Keep its licence notice on anything ported.
- **Unresolved, for the owner: Syabrubesi's Wave ETA.** The design board computed it from the reach speeds and River kms (S0 at -12.2 km at 190 km/h to the border, then 68 km/h to Syabrubesi at 14.6 km) as about 17 min; the storyline in `docs/specs/flash-flood-replay.md` says about 11 min (the real arrival was about 12). The two cannot both hold with the current reach speeds. Not decided here; the wave front and the countdown follow whatever the pack's river line says, so they agree with each other either way.
