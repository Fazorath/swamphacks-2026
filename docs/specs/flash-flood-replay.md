# Flash flood replay: the Bhote Koshi, 26 August 2026

**Status:** ready-for-agent

Supersedes the Gainesville / Alachua County setting and the demo storyline in `docs/specs/storm-shield.md` (ADR 0004). Everything else in that spec still holds: the Mesh, the Hub, Registered and Unverified Nodes, signatures, the Household Profile staying on the device, and only official sources ordering evacuation. Words follow `CONTEXT.md`.

## Problem Statement

On the morning of 26 August 2026 an ice-rock avalanche on Langtang Lirung fell into the Lhende Khola. The debris flow reached the Rasuwagadhi border crossing within minutes and kept going down the Bhote Koshi and Trishuli. Gauges at Syabrubesi and Betrawati went silent as the surge hit them. Nepal's Department of Hydrology and Meteorology (DHM) learned of it at 09:05 and sent SMS alerts at 09:15–09:16. By then the surge had passed Timure and Syabrubesi, and it reached Betrawati about five minutes later. More than a thousand people died and thousands are still missing; most were hydropower workers, pilgrims, drivers and riverside residents.

The people downstream had no way to know what had happened upstream until it reached them. A river surge is unmistakable at the point where it starts, and it travels at a speed that can be estimated, but in 2026 nothing turned "the river just rose metres at the top of the valley" into a warning for the next town down.

## Solution

Storm Shield shows what a handful of amateur Nodes along the river could have done. The demo replays the event as a reconstruction from reported times: five Nodes on one laptop stand in for a Sensor on the Lhende Khola, one at Timure, one at Syabrubesi, the Hub at Betrawati and one at Trishuli. When the top Sensor sees a Surge, the Hub sends one signed Community Warning over the Mesh. Every phone downstream works out from its own home location how many minutes it has before the wave arrives, and counts them down on the event clock.

The Evacuation Plan then picks one of two outcomes. If a Shelter (a public building well above the river) can be reached on foot before the wave, with a safety margin, the plan points there. Otherwise it says there is no Shelter you can reach in time and tells you to get to higher ground, away from the river, now. The replayed DHM alerts appear on the same clock, so the audience sees the gap between the Community Warning and the first official word: about 38 minutes, and at Betrawati about 43 minutes of warning instead of 5.

The internet is lost during the replay and the Mesh keeps carrying readings and the warning. A camera on the Hub plays a recorded clip on the event clock, labelled as a replay.

## User Stories

### Resident downstream (Viewer)

1. As a resident in Betrawati, I want my phone to warn me when the river surges far upstream, so that I can move before the wave reaches me.
2. As a resident, I want the warning to tell me roughly how many minutes I have at my home, so that I can judge whether to grab my family or just run.
3. As a resident, I want the minutes to count down, so that I can see time running out without re-reading the warning.
4. As a resident, I want the countdown worked out on my own phone from my home location, so that my home location never leaves my device.
5. As a resident, I want a clear "wave expected now" once the countdown reaches zero, so that I never see a negative or frozen number.
6. As a resident, I want the warning to say which Sensor saw the surge and how far upstream it is, so that I can trust it is real and not a rumour.
7. As a resident, I want the warning labelled "Community Warning · not official" and pointing me to official sources, so that I know who decides on evacuation.
8. As a resident close to a safe Shelter, I want the plan to point me to that Shelter with its distance, walking time and height above the river, so that I go somewhere that will hold.
9. As a resident with no Shelter reachable in time, I want the plan to say so and tell me to get to higher ground away from the river now, so that I don't walk towards a Shelter I will never reach.
10. As a resident, I want the plan to explain its choice in one line ("12 min walk, wave in 9 min"), so that I can check the reasoning.
11. As a resident, I want Shelters in the river corridor never offered, so that I am never sent towards the water.
12. As a resident, I want the plan to say plainly that it is never an evacuation order, so that I still follow DHM and the district.
13. As a resident, I want replayed DHM and district alerts shown in their official style with their real times, so that I can compare them with the Community Warning.
14. As a resident, I want everything in the replay labelled REPLAY or SIMULATED, so that nobody mistakes the demo for a live event.
15. As a resident, I want to keep receiving readings and the warning after the internet goes down, so that the warning still reaches me in the outage.
16. As a resident, I want a Sensor that has gone silent shown as Stale, so that I understand the upstream station may have been destroyed rather than the river having calmed.
17. As a resident, I want the map to show the river corridor as the Flood-Prone Area, so that I can see where not to be.
18. As a resident, I want to see the Hub's camera, so that I can see the river at Betrawati with my own eyes.

### Sensor Node operator

19. As a Sensor Node operator on the river, I want my Node to raise Flood Risk to High on its own when the water jumps suddenly, so that a surge is caught even before it reaches a fixed level.
20. As an operator, I want the Flood Risk reason to say how much the water rose and over how long, so that I can see why it fired.
21. As an operator, I want my Node's River km set once in its config, so that the Hub knows where along the river my readings come from.

### Hub operator

22. As the Hub operator, I want the Hub to issue one signed Community Warning as soon as one Registered Node reports a Surge, so that no minute is lost waiting for a second Node.
23. As the Hub operator, I want the warning not re-issued while that Surge holds, so that phones are not flooded with repeats.
24. As the Hub operator, I want the warning to land in the Community Warning log with the Node, its River km and the time, so that I can show what was sent and why.
25. As the Hub operator, I want to start the replay with one button and have every Node follow it over the Mesh, so that one press runs the whole demo.
26. As the Hub operator, I want to pause, resume, reset and jump to a named phase of the replay, so that I can rehearse and recover on stage.

### Demo presenter

27. As the presenter, I want an event clock on every screen ("26 Aug 2026 · 08:41 NPT · REPLAY ×30"), so that the audience follows the real timeline.
28. As the presenter, I want the replay to run about four minutes, so that it fits the demo.
29. As the presenter, I want the upstream Sensors to go silent at the times their real gauges did, so that the audience sees the station that warned everyone destroyed after its warning had already gone out.
30. As the presenter, I want two phones, one at Syabrubesi and one at Betrawati, to show the two Evacuation Plan outcomes, so that the choice the system makes is visible.
31. As the presenter, I want one command to start every Node, the Cache Pack server and the replay on one laptop, so that setup takes about two minutes.
32. As the presenter, I want the Join card on the projector, so that a judge can open the dashboard on their own phone.
33. As the presenter, I want a cue in the replay for when to cut the internet, so that the outage lands at the moment the real stations died.
34. As the presenter (stretch), I want the dashboard to show the measured wave speed between the first two Sensors with the arithmetic, so that the ETA can be checked on stage.

## Implementation Decisions

### Region and Nodes

- **One region: the Bhote Koshi–Trishuli valley** from the Lhende Khola down to below Betrawati (Rasuwa and Nuwakot). Gainesville is removed from the defaults, the Cache Pack build and the docs. Tests whose location does not matter keep their Gainesville coordinates.
- **River km** is measured along the river from the Lhende–Kyirong confluence at the border (28.2781 N, 85.3770 E), positive downstream. Each Node is given its River km in config next to its latitude and longitude.
- **Demo Nodes** (one laptop, loopback, see "Stage"):

  | Node | Place | River km | Role |
  |---|---|---|---|
  | S0 | Lhende Khola, below the collapse (hypothetical station in Langtang National Park) | −12.2, measured on the pack's river line at 28.3517 N, 85.4477 E | Sensor; first to surge, silent within a minute |
  | S1 | Timure (28.2528, 85.3667) | 3.4 | Sensor; silent at about 08:45 |
  | S2 | Syabrubesi (28.1632, 85.3391) | 14.6 | Sensor; silent at 08:50 like the real gauge |
  | Hub | Betrawati (27.9731, 85.1860) | 45.6 | Hub, with the camera |
  | S3 | Trishuli (27.9215, 85.1460) | 54.0 | Sensor; last hit, longest countdown |

### Replay

- **Replay** replaces the Scenario as the demo's driver. The Scenario stays in the code for tests and for ticket 0016's breadboard, whose buttons may later drive the Replay controls instead; that is the 0016 owner's call.
- **One replay timeline file in the repo** holds, against event time: each Sensor's track (water level, rain, soil moisture, pressure; reconstructed and labelled as such), the moment each Sensor goes silent, the named phases, the replayed Official Alerts and the internet cue. Each fact cites its source.
- **The Hub runs the event clock.** Start, pause, resume, reset and jump-to-phase are Hub Panel actions. The Hub announces the clock over the Mesh (new message kind `replay`, below) when it changes and every 10 s. Each Node anchors the clock on its own wall clock at receipt, plays its own track from it, and publishes readings every second of real time (30 event seconds), faster than the Scenario's every 3 s, so that every ramp (the shortest lasts a minute of event time) sends at least two readings between the calm level and the first surge reading before the Sensor goes silent (decided 2026-10-17, ticket 0060). Readings from a track are Simulated Readings.
- **Compression ×30.** The window 08:30–10:30 NPT plays in four minutes. Phases: calm (08:30), collapse (08:37), border (08:40), Syabrubesi (08:49), DHM notice (09:05), DHM SMS (09:15), Betrawati (09:20), end (10:30). The end sits just after the 10:28 district warning so it shows (decided 2026-10-17); the Hub pauses the clock there, and Resume at the end is refused until a Reset or jump.
- **Reconstructed values.** Real readings are used where reported (Syabrubesi 1.62 m at 08:40 against a 6 m warning and 9 m danger level; Betrawati last level 3.55 m at 09:20). Surge sizes are invented to clearly trip the Surge rule and are labelled reconstructed.

### Surge and the Community Warning

- **Surge** is a new Flood Risk rule: a Node is High at once when its water level rises by at least a set amount within a short window. The rise and window are named constants beside the existing thresholds in the Flood Risk module. The reason code is `water_surge`; the dashboard writes "water rose 3.2 m in 4 min".
- **The Hub issues a Community Warning when one Registered Node reports a Surge.** This replaces the planned "two or more Registered Nodes High" rule (ticket 0013): a surge is unmistakable and minutes matter. Spoofing is still limited to Registered Nodes: an Unverified Node's Surge is ignored everywhere (not in `surged`, no `water_surge` reason, no High, no warning; ticket 0061). The warning is not re-issued while that Node's Surge holds.
- **ETA is worked out on the Viewer, never on the Hub.** The warning carries the origin Node, its River km and the event time of the surge. The Cache Pack carries the river line with River km and a reconstructed wave speed for each reach: about 190 km/h above the border, about 68 km/h from the border to Betrawati, about 18 km/h below. The dashboard snaps the home in the Household Profile (or, with no profile, the connected Node's position) to the river line, adds up the travel time from the origin's River km to there, and counts down on the event clock. At or past zero it shows "wave expected now". A home upstream of the origin gets no ETA.
- **Stretch:** once two Sensors have surged, the measured speed between them replaces the reconstructed one for the reaches below, and the dashboard shows the arithmetic.

### Evacuation Plan: Shelter or higher ground

- **Shelters** are hand-picked public buildings well above the river (for example the gompa above Syabrubesi, schools on the hillside above Betrawati), each with its height above the river. They stay in the Cache Pack and keep Shelter status from the Hub.
- **A Shelter is reachable** if it lies outside the Flood-Prone Area and its walking time is less than the ETA minus a safety margin. Walking time is straight-line distance × 1.4 at 4 km/h. The margin (5 min), the detour factor and the speed are named constants in the Evacuation Plan.
- **With a Community Warning:** the nearest reachable open Shelter, with distance, walking time and height above the river; otherwise "No Shelter you can reach in time. Get to higher ground, away from the river, now." It never sends anyone into a basement or down towards the river. With no warning, the plan shows the nearest open Shelter as it does today.
- **Routes** are not built for the valley in the main path. The plan works without them, as it already does for a pack with no route grid. Road Routes over the Nepal OSM extract are a stretch ticket.

### Official Alerts

- **The Helene replay becomes a DHM replay** on the event clock, tagged OFFICIAL · REPLAY: DHM learns of the flood (09:05), SMS alerts to riverbank residents of Rasuwa, Nuwakot, Dhading and Chitwan (09:15), warnings for Galchhi, Muglin and the Prithvi Highway (10:28, just before the replay ends). Sources become `dhm`, `ndrrma` and `district`; `applies_to` keeps `flood_prone_area` for "riverbank residents".
- **Live NWS and NHC feeds are dropped** (ticket 0017 removed).
- **The lead-time line** in the Alerts Panel compares the first Community Warning with the first Official Alert on the event clock.

### Cameras

- **The FL511 cameras are removed.** The Hub's camera plays a recorded clip of the flood synced to the event clock, labelled "CAMERA · REPLAY 09:18 NPT". The stage clip lives in a gitignored folder on the demo laptop, because we do not hold its rights. A credited Creative Commons clip is committed as the fallback, so a fresh clone still works. The Offline and Unavailable states stay.

### Cache Pack

- Rebuilt for the valley box. Tiles cover a narrower zoom range so the larger box stays small. FEMA zones and the creek floodplains are replaced by a hand-drawn river corridor as the Flood-Prone Area. A new `river.geojson` holds the river line with River km and the reach speeds. The hand-picked Shelters cite their OSM ids or sources.

### Message formats (decided 2026-10-17, `docs/specs/wire-formats.md`)

- `warning` gains `origin` (Node id), `origin_km` and `surge_t` (event time, Unix seconds), and the reason code `water_surge`.
- New kind `replay`: `{ "v": 1, "kind": "replay", "state": "playing", "event_t": 1787733000, "rate": 30 }`. `state` is `playing`, `paused` or `stopped`; `event_t` is the event time at the moment of sending. Only the Hub may send it.
- `alert.source` gains `dhm`, `ndrrma` and `district`.

### Stage

- **One laptop, a projector and two phones.** The laptop runs all five Nodes on loopback, the Cache Pack server and its own hotspot, so no venue Wi-Fi or internet is needed. The projector shows the Hub dashboard. Phone 1 has a Household Profile at Syabrubesi (higher ground); phone 2 at Betrawati (a Shelter). A judge can join with the Join card. One script starts everything and prints the dashboard address.
- "Cut the internet" on stage is stopping the Cache Pack server and marking the Hub Mesh-only at the replay's internet cue, as in the existing rehearsal recipe. A Pi, if one turns up, replaces S0 without changing anything else.

## Testing Decisions

- **Good tests** drive the system only through a seam and assert what a resident or operator would see: readings, Flood Risk and reasons, warnings issued or not, the ETA and the plan's outcome. No internals, no call counts. Test names use the glossary's words.
- **Seam A: the Node HTTP API with the in-memory Mesh (pytest).** Covers:
  - a replay started on the Hub reaches every Node, and each Sensor's readings follow its track;
  - pause, resume, reset and jump-to-phase reach every Node;
  - a Sensor whose track ends goes Stale;
  - a sudden rise makes that Node High with `water_surge`, and a slow rise does not;
  - the Hub issues exactly one signed warning for one Registered Node's Surge, with origin, River km and event time; none for an Unverified Node; no repeat while the Surge holds;
  - replayed DHM alerts reach every Node labelled replay, at their event times.

  Prior art: `MeshedNodes`, its `hear_from` and `advance`, and `start_hub` in the Node tests.
- **Seam B: the Evacuation Plan function (Vitest).** Covers:
  - the ETA from origin River km and reach speeds to a home;
  - a countdown that reaches "wave expected now";
  - no ETA upstream of the origin;
  - a reachable Shelter chosen over a nearer one inside the Flood-Prone Area;
  - higher ground when walking time plus the margin exceeds the ETA;
  - closed Shelters skipped;
  - no evacuation language from the plan itself.

  Prior art: the existing Evacuation Plan tests with fixture Cache Packs.
- **No new seams.** The dashboard's event clock and camera clip are checked with Vitest component tests like the existing flow tests.
- **Manual rehearsal on one laptop** with two phones over the hotspot or Tailscale runs the full replay. It proves the software path only. Wi-Fi discovery between real devices, and any Pi, stay unproven.

## Out of Scope

- Real sensors, real gauge data feeds, LoRa or relay hardware. A real Mesh along 60 km of mountain valley would need relay Nodes; the demo says so in one line and does not claim to prove it.
- Live DHM, NDRRMA or NWS feeds.
- Routes along roads in the main path (stretch), walking Routes on footpaths, and on-device rerouting (0018, parked).
- Any region other than this valley, and a region setting.
- Casualty modelling, inundation maps or any claim about how many lives would have been saved.
- Storm Shield ordering evacuation. Plans say "get to higher ground" as safety advice and always point to official sources.

## Further Notes

- **Demo storyline (about 4 minutes of replay):**
  1. 08:30 calm: five Registered Nodes along the valley, camera at Betrawati.
  2. 08:37 S0 surges; the Hub's Community Warning reaches every phone within seconds. Syabrubesi shows about 11 min, Betrawati about 43.
  3. S0, S1 and S2 go silent as the wave passes them; their cards turn Stale.
  4. Phone 1 (Syabrubesi): "No Shelter you can reach in time. Get to higher ground." Phone 2 (Betrawati): the hillside Shelter, 12 min walk.
  5. 09:15 the replayed DHM SMS arrives. The lead-time line reads "Community Warning 08:37 · first official SMS 09:15".
  6. Internet cue at 09:20: the camera tile goes Offline, readings and the countdown keep going over the Mesh.
- **Tone.** This happened seven weeks ago to real families and the search is not over. On screen and in the pitch: the replay is "a reconstruction from reported times", never the official record; no casualty total is presented as final (cite NDRRMA with its date if a number is needed at all); no victim imagery; no "Himalayan tsunami"; the origin was in Nepal, so do not blame China for the start. Many victims were migrant workers and pilgrims.
- **Honest limits, said out loud.** Near the source the wave was fast enough that Timure would have had one to eight minutes. The gain is real from Syabrubesi downstream. Arrival times at Rasuwagadhi, Timure and Syabrubesi are inferred from gauges going silent, and the surge sizes are invented; the pitch, the README and the replay timeline file all say so.
- **Sources** (checked 2026-10-17):
  - Kathmandu Post, how the flood unfolded: https://kathmandupost.com/national/2026/08/27/how-the-bhotekoshi-flood-unfolded-over-10-hours
  - ICIMOD, Kyirong–Rasuwa flood 2026: https://www.icimod.org/?p=78368
  - Kathmandu Post, NDRRMA toll on 4 Sep: https://kathmandupost.com/national/2026/09/04/nepal-flood-death-toll-reaches-1-287
  - Republica, why early warning failed: https://myrepublica.nagariknetwork.com/news/rasuwa-flood-why-did-early-warning-fail-despite-systems-in-place-64-74.html
  - Nepali Times, distance to the border: https://nepalitimes.com/more-clues-about-the-nepal-china-flood
  - River km and place coordinates: OpenStreetMap (Overpass), measured from the Lhende–Kyirong confluence.
- **"Storm Shield" is a working name** and may change before submission; don't build anything that depends on it.
