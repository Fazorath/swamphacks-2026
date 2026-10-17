# Storm Shield

**Status:** ready-for-agent

## Problem Statement

When a hurricane approaches Gainesville / Alachua County, residents rely on internet-delivered information: NWS alerts, NHC forecasts, county evacuation orders, shelter lists and map apps. Two things go wrong:

1. **The information is not local enough.** No active USGS gauge sits on Hogtown Creek or Sweetwater Branch, so nobody can see that water is rising on *their* street until it is in their yard. Official alerts cover a whole zone (FLZ136); Alachua County has no lettered evacuation zones, and its orders target housing types (mobile/manufactured homes, RVs, unsafe housing) and "areas subject to flooding" that a resident has to interpret for themselves.
2. **It disappears exactly when it is needed.** When cell towers and home internet fail mid-storm, the dashboards, alerts and maps go dark. A resident in a mobile home who did not write down the nearest open Shelter and a route to it is left guessing.

## Solution

Storm Shield is a neighborhood disaster dashboard. Neighbors run Sensor Nodes that share Community Readings over a local Reticulum mesh, so the neighborhood keeps seeing live conditions with no internet at all. One Node, the Hub, brings Official Alerts and the Cache Pack into the mesh while it has internet. It also issues signed Community Warnings when two or more Registered Nodes report High Flood Risk.

Every Node serves the same dashboard to Viewers (phones, browsers) on the local network. The dashboard shows a shared map, live Community Readings, Flood Risk with its reasons, Official Alerts and public camera tiles. It also shows an Evacuation Plan personalized to a Household Profile that never leaves the resident's device. The plan combines the resident's risk, whether the official order applies to their home, the nearest open Shelter that fits their needs, and a route precomputed into the Cache Pack. It keeps working with zero internet.

Storm Shield adds local ground truth next to official sources and never replaces them. Only official sources tell anyone to evacuate.

For the hackathon, the Nodes are one Raspberry Pi 4 with a breadboard of buttons and switches, plus four teammates' laptops. All readings are Simulated Readings driven by a Scenario. Official Alerts come from a labeled replay of Hurricane Helene (Sept 2024) that runs through the same code path as live feeds.

## User Stories

### Resident (Viewer)

1. As a resident, I want to open the dashboard on my phone by joining the neighborhood Wi-Fi, so that I don't need an app install or an account.
2. As a resident, I want to see a map of my neighborhood with every Node's latest Community Readings, so that I know conditions near me right now.
3. As a resident, I want each Node's position shown only approximately (about 200 m), so that I trust that neighbors' homes are not exposed, and so are mine if I run a Node.
4. As a resident, I want readings to show how old they are, so that I can tell live data from a Node that went quiet.
5. As a resident, I want Simulated Readings clearly labeled as simulated, so that I am never misled about where a number came from.
6. As a resident, I want readings from Unverified Nodes shown greyed out and marked as not counted, so that I understand why they don't affect Flood Risk.
7. As a resident, I want to see the Flood Risk (Low, Elevated or High) for my area, so that I can judge the danger at a glance.
8. As a resident, I want Flood Risk to list the reasons behind it (for example "water level rising at 2 Nodes", "heavy rain for 30 min"), so that I can check the reasoning instead of trusting a black box.
9. As a resident, I want to see a storm signal on the map when pressure falls across Nodes, so that I notice the hurricane's approach.
10. As a resident, I want Official Alerts shown in their own distinct style with their source (NWS, NHC, Alachua County), so that I never confuse them with community information.
11. As a resident, I want replayed Official Alerts labeled "OFFICIAL · REPLAY", so that a demo or drill is never mistaken for a live order.
12. As a resident, I want Community Warnings labeled as non-official and always pointing me to official sources for evacuation decisions, so that I know who actually decides.
13. As a resident, I want my dashboard to show only Community Warnings with a valid Hub signature, so that nobody can spoof a warning onto my screen.
14. As a resident, I want public camera tiles when the internet is up, so that I can see roads and water nearby.
15. As a resident, I want camera tiles to grey out with a clear "offline" state when the internet drops, so that I don't think a frozen image is live.
16. As a resident, I want to enter a Household Profile (home location, housing type, special-needs, pets) once, so that my Evacuation Plan fits my household.
17. As a resident, I want my Household Profile stored only on my own device and never sent to any Node, so that my home address and needs stay private.
18. As a resident, I want to set my home location by tapping the map, so that I don't need to type an address or geocode online.
19. As a resident in a mobile home or RV, I want my Evacuation Plan to say clearly when the county order covers my housing type, so that I know the order is about me.
20. As a resident living in a Flood-Prone Area, I want my Evacuation Plan to say my home is in one, so that I understand my exposure.
21. As a resident, I want the nearest open Shelter that fits my needs (special-needs, pet-friendly), so that I don't drive to one that will turn me away.
22. As a resident, I want a route from my home to that Shelter drawn on the map, so that I can get there without a map app.
23. As a resident, I want my Evacuation Plan to work with no internet, so that I still have it when the network is down.
24. As a resident, I want Shelter open/closed status to update over the mesh, so that my plan reflects the latest county announcements even offline.
25. As a resident, I want the dashboard to tell me whether it is currently online or mesh-only, so that I understand what information may be stale.
26. As a resident, I want the dashboard to keep updating if the Node I'm connected to is a laptop that another Node can replace, so that one neighbor shutting their laptop doesn't blind me.
27. As a resident, I want official evacuation instructions to always link back to the official source, so that I can verify them when the internet returns.

### Sensor Node operator (neighbor / teammate)

28. As a Sensor Node operator, I want to start my Node with one command, so that joining the mesh takes seconds.
29. As a Sensor Node operator, I want my Node to find other Nodes on the local Wi-Fi automatically, so that I don't configure addresses.
30. As a Sensor Node operator, I want to register my Node with the Hub once, so that my readings count toward Flood Risk and Community Warnings.
31. As a Sensor Node operator, I want my Node to keep sharing readings when the internet is down, so that it is useful exactly when it matters.
32. As a Sensor Node operator, I want my Node to compute Flood Risk locally from what it sees, so that my household still sees risk rising if the Hub goes down.
33. As a Sensor Node operator, I want my Node to download the full Cache Pack while online, so that it can serve Evacuation Plans to Viewers offline.
34. As a Sensor Node operator, I want my Node's location fuzzed before it is shared, so that my exact home is never broadcast.
35. As a Sensor Node operator on a laptop, I want to step the Scenario from the keyboard or dashboard, so that I can produce Simulated Readings without a breadboard.
36. As the Pi's operator, I want breadboard buttons and switches (pressure drop, rain, water rising) to step the Scenario, so that the storm can be driven physically on stage.

### Hub operator

37. As the Hub operator, I want to see a registry of every Node and whether it is Registered or Unverified, so that I know who is on the mesh.
38. As the Hub operator, I want to accept a Node's identity at sign-up, so that only known Nodes count.
39. As the Hub operator, I want the registry shared over the mesh, so that every Node counts only Registered Nodes when computing Flood Risk.
40. As the Hub operator, I want the Hub to send a signed Community Warning automatically when two or more Registered Nodes report High Flood Risk, so that one faulty or fake sensor can't trigger a warning.
41. As the Hub operator, I want a Community Warning log, so that I can show what was sent and why.
42. As the Hub operator, I want the Hub to pull Official Alerts (NWS FLZ136, NHC, Alachua County) while online and forward them over the mesh, so that offline Nodes still see the latest official word.
43. As the Hub operator, I want a replay mode that plays the Hurricane Helene alerts and county order through the same path as live feeds, so that the demo is realistic and honest.
44. As the Hub operator, I want to push Shelter status updates over the mesh, so that Nodes stay current without re-downloading the Cache Pack.
45. As the Hub operator, I want the Hub to keep working when its internet cable is pulled, so that mesh features continue and only online-only features (cameras, live feeds) stop.

### Demo presenter

46. As the presenter, I want a "normal day" state with five Registered Nodes, live readings and no Flood Risk shown, so that the demo opens calmly.
47. As the presenter, I want one button press to start the pressure drop across Nodes, so that the storm's approach is visible immediately.
48. As the presenter, I want the rain switch and water-rising button to push two Nodes to High and trigger a Community Warning within seconds, so that the climax lands on cue.
49. As the presenter, I want to pull the Hub's USB tether and see readings keep flowing, so that the offline story is proven live.
50. As the presenter, I want to close one laptop Node and see the rest continue, so that the mesh visibly survives a dead Node.
51. As the presenter, I want a phone with a mobile-home Household Profile to show Flood Risk High, the replayed county order, the nearest open Shelter and its route with zero internet, so that the demo ends on the resident's outcome.
52. As the presenter, I want a way to reset the Scenario to "normal day" on every Node, so that we can rehearse repeatedly.

## Implementation Decisions

### Shape of the system

- **One Node program, two roles.** Every Node runs the same Python (FastAPI) service, managed with uv. Configuration says whether it is a Sensor Node or the Hub. The Hub is also a Node (ADR 0002); it adds the registry, Community Warning issuing, the official feeds and the Cache Pack download.
- **One dashboard, served by every Node.** A React + Vite + TypeScript + Leaflet app, managed with pnpm, built once and served as static files by every Node. Viewers load it from whichever Node they connect to. On the Hub the same app also shows the Node registry and the Community Warning log.
- **Network layout.** The Pi runs its own Wi-Fi hotspot with no internet; every laptop and phone joins it. The Hub laptop gets internet only through a USB-tethered phone, and "internet off" on stage means unplugging that cable. The Pi is never the Node that gets shut down, because it is the network.
- **Mesh: Reticulum from ticket one** (ADR 0001), using AutoInterface over the hotspot Wi-Fi to discover peers. Every Node has a Reticulum identity, which provides Node registration and Community Warning signatures.

### Node modules (deep, small interfaces)

- **Mesh.** The only module that knows about Reticulum. Interface: publish a message of a known kind (Community Reading, Community Warning, registry update, Official Alert, Shelter status update), and subscribe to incoming messages with the sender identity already verified. It has two implementations: Reticulum (real) and in-memory (tests, several Nodes in one process). This is test seam A's swap point.
- **Scenario.** Owns the scripted storm sequence: normal day → pressure drop → rain → water rising, plus reset. Inputs: digital GPIO buttons and switches on the Pi (the Pi has no analog input), and a keyboard or HTTP step on laptops. Output: Simulated Readings (pressure, rain rate, water level, soil moisture), always flagged as simulated, published through Mesh at a steady cadence.
- **Reading store.** Keeps the latest Community Readings per Node from everything Mesh delivers, with timestamps for staleness. It applies location fuzzing (about 200 m) to this Node's own readings before they are published; positions from other Nodes are only ever fuzzed values.
- **Registry.** On the Hub it is the source of truth: it accepts Node identities at sign-up and publishes the signed registry over Mesh. On every Node it holds the latest Hub-signed registry and answers whether a Node is Registered. Unknown senders are Unverified.
- **Flood Risk.** A pure function of the Community Readings a Node can see plus the registry. Output: Low / Elevated / High, or nothing in calm weather, and a list of human-readable reasons. Only Registered Nodes' readings count. The rules are transparent thresholds on water level, rain rate and trend, kept in one place; pressure drives the storm signal and soil moisture drives the Low level (first-pass values are in ticket 0006).
- **Community Warning issuer (Hub only).** Watches per-Node Flood Risk. When two or more Registered Nodes are High, it issues one Community Warning signed with the Hub identity. The warning is labeled non-official, names the Nodes and reasons, and always points to official sources for evacuation. It does not re-issue while the condition holds, and every warning lands in the Community Warning log. Nodes show only warnings whose signature verifies against the Hub identity in their registry.
- **Official feeds (Hub only).** Live mode polls NWS `alerts/active?zone=FLZ136` (User-Agent header required), NHC `CurrentStorms.json` and Alachua County notices. Replay mode feeds recorded Hurricane Helene NWS alerts and the Alachua County evacuation order through the same normalization path. Each alert is tagged with its source and with live or replay, and both are forwarded over Mesh.
- **Cache Pack.** Built by a script ahead of the event, not on the Nodes, and published as a downloadable file the Hub fetches while online. Each Node then downloads the full pack while online (from the internet or from the Hub). Contents:
  - Shelters: about 20 pre-identified sites from the FDEM Alachua table, with special-needs (Senior Recreation Center) and pet-friendly flags, cross-checked against FEMA open shelters.
  - Flood-Prone Areas: FEMA NFHL zones plus the Hogtown Creek and Sweetwater Branch floodplains.
  - Map tiles for the neighborhood.
  - Precomputed routes: a grid of points over the area, with a route from every grid point to every Shelter, built from the Geofabrik Florida OSM extract.

  Only small updates (Shelter status, Official Alerts) cross the mesh; the pack itself never does.
- **Node HTTP API.** The dashboard-facing contract and test seam A. It exposes: this Node's identity, role and online/mesh-only status; current Community Readings with Registered/Unverified status, staleness and simulated flags; Flood Risk with reasons; Official Alerts; verified Community Warnings; the Cache Pack and the latest Shelter statuses; Scenario step and reset; and node sign-up. The Hub additionally exposes the registry and the Community Warning log. The dashboard polls one `GET /api/state` snapshot every second (`docs/specs/wire-formats.md`).

### Dashboard modules

- **Map and readings view.** Leaflet map from Cache Pack tiles, with Nodes at fuzzed positions, latest readings, greyed Unverified Nodes, a storm signal when pressure is falling, and Flood-Prone Area overlay.
- **Alerts panel.** Official Alerts in a distinct style, with source and an "OFFICIAL · REPLAY" label when replayed. Community Warnings sit in a separate style labeled non-official, with a link to official sources.
- **Camera tiles.** Public camera images while the Node reports online; greyed "offline" tiles otherwise. The **camera source is deferred**: any free, accessible public feed (FL511 / FDOT and similar), picked when the camera ticket comes up.
- **Household Profile.** A form plus tap-to-set home location, stored in the Viewer's browser storage only and never sent to a Node.
- **Evacuation Plan.** A pure function, and test seam B. It takes the Household Profile, the Cache Pack, the latest Shelter statuses, Flood Risk and Official Alerts, and returns:
  - the resident's Flood Risk and its reasons;
  - whether the home is in a Flood-Prone Area;
  - which Official Alerts and orders apply to this household (for example, an order targeting mobile homes/RVs applies to a mobile-home profile, and an "areas subject to flooding" order applies to a home in a Flood-Prone Area);
  - the nearest open Shelter matching special-needs and pet requirements;
  - the precomputed route from the grid point nearest home to that Shelter.

  The plan never tells anyone to evacuate on Storm Shield's own authority; evacuation language comes only from Official Alerts.

### Message formats

The wire formats for Community Reading, Community Warning, registry update, Shelter status update and the Cache Pack layout are **decided in `docs/specs/wire-formats.md`** , written after this spec because they are designed with the dashboard. From now on, changing a format needs the whole team. Fixed now: every mesh message carries its kind, sender identity, timestamp and a signature (made with the sender's Reticulum identity). Community Readings carry the simulated flag and a fuzzed position. Official Alerts carry source and live or replay.

### Build order

The cut line comes first, and the tickets build it end to end. One Sensor Node publishes Simulated Readings over Reticulum, the dashboard shows them, the internet is unplugged, readings keep updating, and a cached Evacuation Plan renders. Everything else in the demo storyline follows. Large upgrades are stretch tickets ordered last.

## Testing Decisions

- **What a good test is.** It drives the system only through a seam and asserts on what a resident or operator would observe: readings visible, Flood Risk level and reasons, warnings issued or not, plan contents. It never reaches into module internals, private state or call counts. Tests use the glossary's words in their names.
- **Seam A: Node HTTP API with an in-memory mesh (pytest).** Several Node instances (one Hub and several Sensor Nodes) are started in one test process, wired together through the in-memory Mesh, and driven through the HTTP API (Scenario steps, sign-up, internet on/off). Behaviors covered:
  - readings published by one Node appear on every other Node's API, flagged simulated, with fuzzed positions;
  - Unverified Nodes' readings appear but are excluded from Flood Risk;
  - Flood Risk is absent on a calm day, then moves Low → Elevated → High as the Scenario advances, with reasons;
  - the Hub issues exactly one signed Community Warning when the second Registered Node goes High, and none when only one is High or when the High Nodes are Unverified;
  - a warning with a bad signature is not shown;
  - replayed Helene alerts reach every Node labeled as replay;
  - Shelter status updates propagate;
  - with the Hub's internet marked off, readings and Flood Risk keep updating and camera/online status reports offline;
  - removing a laptop Node leaves the rest working.
- **Seam B: the Evacuation Plan function (Vitest).** It is fed fixture Cache Packs, Household Profiles, Shelter statuses, Flood Risk values and Official Alerts. Behaviors covered:
  - a mobile-home profile matches the county order;
  - a site-built home outside a Flood-Prone Area does not;
  - closed Shelters are skipped;
  - special-needs and pet requirements choose the right Shelter;
  - the route comes from the nearest grid point;
  - with no Official Alert, the plan contains no evacuation language.
- **Flood Risk rules** are exercised through seam A. They get no separate seam, which keeps the seam count at two.
- **Real Reticulum, GPIO and the hotspot are not unit-tested.** They are checked by a manual rehearsal that runs the seven-beat demo storyline on the real Pi and laptops, including the cable pull and closing a laptop. Rehearse the cut line on Saturday (ADR 0001).
- **Prior art:** none yet; the repo has no code. The first ticket on each side sets the pattern (FastAPI TestClient with the in-memory Mesh; Vitest with fixture Cache Packs).

## Out of Scope

- Real sensors, analog input, ESP32 or LoRa hardware. All readings are Simulated Readings.
- Phones as Nodes. Phones are Viewers only.
- Storm Shield issuing or implying evacuation orders. Only official sources do that.
- A cloud server or cloud mirror of the Hub (ADR 0002).
- Accounts, logins or any server-side storage of Household Profiles.
- Geocoding addresses; home location is set on the map.
- Live camera feeds while offline, and choosing the camera source now.
- On-device rerouting when roads are blocked (a low-priority stretch).
- Carrying the Cache Pack over the mesh.
- Push notifications, SMS, or anything outside the dashboard.
- Coverage beyond Gainesville / Alachua County.

## Further Notes

- **Demo storyline (3 minutes):**
  1. Normal day: five Registered Nodes, no Flood Risk shown, camera tiles live.
  2. The pressure-drop button starts the storm signal.
  3. The replayed Helene NWS alert arrives (OFFICIAL · REPLAY).
  4. The rain switch and water-rising button push two Nodes to High, and the Hub sends a signed Community Warning.
  5. The cable is pulled: cameras grey out, readings keep flowing.
  6. One laptop Node is closed and the mesh keeps working.
  7. A phone with a mobile-home profile shows Flood Risk High, the county order, the nearest open Shelter and its route, offline.

  Judges only see this demo, so build what shows on stage first.
- **Deferred, tracked, not blocking:** the public camera source.
- **Sources:**
  - Helene evacuation order: https://alachuacounty.us/News/Article/Pages/Hurricane-Helene-Update-11-–-Evacuation-Order-in-Effect.aspx
  - FEMA open shelters: https://gis.fema.gov/arcgis/rest/services/NSS/OpenShelters/FeatureServer/0
  - FDEM Alachua shelter table: https://prod.floridadisaster.org/globalassets/dem/response/sesp/2018/counties/alachua-county.pdf
  - NWS alerts: https://api.weather.gov/alerts/active?zone=FLZ136
  - NHC current storms: https://www.nhc.noaa.gov/CurrentStorms.json
  - Santa Fe River USGS gauges 02321975, 02321958, 02321500 and 02320700, and the Cedar Key tide gauge 8727520, are possible context layers. No live gauge exists on Hogtown Creek or Sweetwater Branch, so Storm Shield's Nodes would be the only live creek data there.
- `docs/plan.html` (pre-grilling, still says "Beacon Mesh") is superseded by this spec.
- Next: UI design doc and `docs/specs/wire-formats.md` are done; then `to-tickets`, then fill in Idea / Stack / Commands in `AGENTS.md`.
