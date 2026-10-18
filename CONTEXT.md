# Storm Shield

A community flood warning dashboard, demonstrated on a replay of the 26 August 2026 flood down the Bhote Koshi and Trishuli in Nepal (ADR 0004). Community sensor readings are shared over a local mesh, so a surge seen upstream warns the towns downstream, and residents keep their warning and evacuation plan when the internet goes down. It adds local ground truth next to official information (DHM, NDRRMA, district offices); it never replaces it.

## Network

**Mesh**:
The set of Nodes that reach each other peer to peer, directly or through one another, with no internet needed.
_Avoid_: network, cloud, backend

**Node**:
Any device taking part in the Mesh.
_Avoid_: peer, device, client

**Node id**:
The 12-character code taken from a Node's permanent Reticulum identity; it is how Nodes, the registry and the API refer to a Node.
_Avoid_: identity, address, hash

**Node name**:
The label an operator gives a Node, such as "garage"; it is shown to people and never used to tell Nodes apart.
_Avoid_: id, username

**Sensor Node**:
A Node that produces Community Readings from attached or simulated sensors.
_Avoid_: station, sensor box

**Registered Node**:
A Node whose Node id the Hub has accepted at sign-up; only its Community Readings count toward Flood Risk and Community Warnings.
_Avoid_: trusted node, verified device

**Unverified Node**:
A Node the Hub does not know; its readings are shown but never counted.
_Avoid_: rogue node, guest

**Sign-up**:
A Node's signed request, sent over the Mesh, to be added to the Node registry under its Node name; it waits until the Hub operator accepts it.
_Avoid_: enrolment, pairing, join request

**Node registry**:
The Hub's signed list of Registered Nodes (Node id and Node name), always including the Hub itself; with no registry received yet, no Node counts.
_Avoid_: allowlist, roster, trust list

**Hub**:
The one Node that collects every Community Reading, issues Community Warnings and hosts the central dashboard; when it has internet it also brings Official Alerts and the Cache Pack into the Mesh.
_Avoid_: gateway, central server, cloud, backend

**Mesh-only**:
A Node that currently has no internet and still takes part in the Mesh. Each Node reports only its own state: Online or Mesh-only. Online-only features (camera tiles, live feeds) stop while a Node is Mesh-only; everything carried over the Mesh keeps working.
_Avoid_: offline node

**Viewer**:
A phone or browser that shows the dashboard by connecting to a Node, without being part of the Mesh itself.
_Avoid_: client, user device

## Information

**Community Reading**:
One timestamped measurement from a Sensor Node, such as pressure or soil moisture.
_Avoid_: data point, sample, telemetry

**Simulated Reading**:
A Community Reading whose value comes from a breadboard input or replay script instead of a real sensor; always labeled as such.
_Avoid_: fake reading, mock data

**Fuzzed Position**:
A Node's location snapped to a grid of about 200 m before anything is published; the true location never leaves the Node. A fixed grid, not random jitter, because jitter can be averaged away by an observer collecting many readings.
_Avoid_: exact location, coordinates

**Scenario**:
A scripted storm sequence (normal day, pressure drop, rain, water rising) that produces Simulated Readings, stepped forward by the laptop keyboard or HTTP, or jumped to a named step by a wire touched to a breadboard input. No longer the demo's driver (the Replay is); kept for tests and the breadboard. A press changes only the Pi's own Node and does nothing visible while the Sensor is playing a Replay.
_Avoid_: demo script, simulation, playback

**Replay**:
A reconstruction of a real flood from reported times, played on the Event clock: each Sensor Node follows its own track of Simulated Readings, and the recorded Official Alerts and camera clip appear at their real times. Always labelled REPLAY.
_Avoid_: playback, recording, simulation

**Event clock**:
The time inside the Replay (for example 26 Aug 2026 · 08:41 NPT), run by the Hub and followed by every Node; it moves ×30 faster than real time and can be paused or jumped to a named phase.
_Avoid_: replay time, sim time

**River km**:
A Node's or home's distance along the river from the Lhende–Kyirong confluence at the border, positive downstream; set in each Node's config and measured on the river line in the Cache Pack.
_Avoid_: chainage, mile marker, distance

**Wave ETA**:
How long the Surge in a Community Warning takes to reach a Viewer's home, counted down on the Event clock. Worked out on the Viewer from the home snapped to the river line (never on the Hub, and the home never leaves the device); with several warnings it follows the earliest arrival; a home upstream of the origin, or more than 2 km from the river line, has none.
_Avoid_: countdown, arrival time, ETA (alone)

**Measured wave speed**:
The speed of a Surge between the first two Registered Nodes that surged, worked out by the Hub from their River kms and Surge times and carried on the Community Warning; it replaces the reconstructed speed for the reaches below the second Node.
_Avoid_: actual speed, live speed

**Official Alert**:
A warning or order issued by DHM, NDRRMA or a district office, shown distinctly from community information.
_Avoid_: warning, notification

**Community Warning**:
A signed warning the Hub issues when one Registered Node reports a Surge; it names that Node and its River km so each Viewer can work out when the wave reaches its home. Never an evacuation order, and always points residents to official sources for evacuation decisions.
_Avoid_: alert, alarm, evacuation notice

**Cache Pack**:
The bundle of offline information (Shelters, Flood-Prone Areas, map tiles, and Routes) built once by a script, then downloaded by every Node while online and served from its own disk so it works without internet. The Hub gets it from a GitHub Release (or a laptop serving the zip while the repo is private); sensor Nodes get it from the Hub.
_Avoid_: offline data, bundle, snapshot

**Flood Risk**:
A community estimate of flooding danger (Low, Elevated or High) that every Node derives from the Community Readings it can see. Low is shown only while it is Raining or the Storm Signal is on. Elevated and High come from a Node's own water level and rain rate, so water at 300 cm or more shows Elevated even on a calm day. With none of these, no Flood Risk is shown at all.
_Avoid_: flood score, danger level, threat level

**Raining**:
The condition, judged across the Mesh and not from any single Node, that soil moisture is rising at two or more of the Nodes that count (or at the only one that counts). It is what lets Flood Risk appear as Low.
_Avoid_: wet weather, precipitation

**Surge**:
A sudden rise in one Node's water level, at least a set amount within a short window; it makes that Node's Flood Risk High at once and triggers a Community Warning.
_Avoid_: spike, flash, wave

**Storm Signal**:
The dashboard indicator that air pressure is low across the Nodes that count, a sign a storm is approaching. It stays on while pressure stays low and is separate from Flood Risk, though it makes Flood Risk appear (as Low) when nothing else would.
_Avoid_: storm warning, storm alert, pressure alarm

## Evacuation

**Evacuation Plan**:
What a resident should do and where to go: their risk, and either the nearest open Shelter they can walk to before the wave or, if there is none, higher ground away from the river. Their risk is the Mesh-wide Flood Risk (the worst level across the Nodes that count), not a level tied to where their home is.
_Avoid_: evac info, escape route

**Reachable Shelter**:
An open Shelter that fits the household, lies outside the Flood-Prone Area, and can be walked to before the wave: its walking time is less than the Wave ETA minus a safety margin. Re-judged every second on the Event clock; with none, the Evacuation Plan says to get to higher ground.
_Avoid_: safe Shelter, nearest Shelter (the nearest need not be reachable)

**Household Profile**:
A resident's home location, housing type (site-built or mobile home/RV), and whether they need a special-needs or pet-friendly Shelter; kept only on their own device. The one thing it reveals is the Grid point nearest home, when the Viewer asks its connected Node for the Route; never to the rest of the Mesh.
_Avoid_: user profile, account, settings

**Route**:
The driving path from a Grid point to a Shelter, precomputed into the Cache Pack. It is the shortest drive and ignores Flood-Prone Areas and live road conditions; its length ranks Shelters. When it crosses a Blocked Road or a Flood-Prone Area, the phone replaces it with one computed on the device. A Shelter with no Route from the resident's Grid point ranks after every Shelter that has one, by straight-line distance and labelled as such, with no line drawn.
_Avoid_: directions, navigation, path

**Blocked Road**:
A road segment a resident marked as impassable by tapping the map; kept only on their own device, never sent over the Mesh. The Evacuation Plan reroutes around it from the Road graph, so the Route is then computed on the phone from the actual home rather than read from the Cache Pack.
_Avoid_: closure, roadblock, obstruction

**Road graph**:
The drivable roads of the Cache Pack area as junctions joined by segments with their length, a file in the pack. Rerouting runs on it; it is separate from Routes, which are precomputed lines.
_Avoid_: road network, map data

**Grid point**:
One of the evenly spaced points, about 100 m apart, that cover the roads of the Cache Pack area; a home takes the Route of its nearest Grid point. Areas more than about 100 m from a drivable road have none.
_Avoid_: waypoint, cell, node

**Shelter**:
A public building well above the river, picked by hand into the Cache Pack, where people can wait out a flood.
_Avoid_: refuge, safe place

**Shelter status**:
Whether a Shelter is open or closed, set by the Hub operator and announced over the Mesh; a Shelter counts as open only once the Hub has announced it.
_Avoid_: availability, capacity

**Flood-Prone Area**:
The river corridor, drawn by hand along the Lhende Khola, Bhote Koshi and Trishuli; a Shelter inside it is never offered. The map always marks it approximate.
_Avoid_: evacuation zone, surge zone

## Dashboard

**Warning Takeover**:
The modal that interrupts any view when a new Official Alert or Community Warning arrives, with one large acknowledge button; it fills a phone's screen and floats over the dimmed map on a larger one. Acknowledging it on one device never clears it on another.
_Avoid_: popup, alarm, klaxon, notification

**Stale**:
A Node whose last Community Reading arrived more than 15 seconds ago by the receiving Node's own clock; after 60 seconds its readings stop counting toward Flood Risk. The age is shown on the Node's map marker and Node card.
_Avoid_: offline node, dead node, timed out

**Node unreachable**:
The dashboard's state when a Viewer gets no answer from the Node it is connected to. It is about the Viewer's link to its own Node, not the Mesh: a Node can be Mesh-only or have Stale peers and still be reachable. While it lasts, live readings, Flood Risk, online status and camera pictures are not shown; what is already on the Viewer's device (the Cache Pack, the Household Profile) stays.
_Avoid_: offline, disconnected, down

**Layer rail**:
The column of buttons along the left edge of the dashboard that shows and hides map layers and Panels, each with a live count where one applies.
_Avoid_: sidebar, toolbar, nav

**Weather layer**:
One of Wind, Temperature, Cloud cover or Rain, drawn over the map from a Weather Grid; only one shows at a time, chosen from the Weather button on the Layer rail. It is context for the valley, never a measurement at a village and never offered as a cause of the flood.
_Avoid_: overlay, weather widget, radar

**Weather Grid**:
Hourly wind, temperature, cloud cover and rain on a coarse grid of points (about 0.1° apart) over the valley. During the Replay it is the recorded weather of 26 August 2026, built into the Cache Pack; otherwise it is the Hub's last good forecast, shown with its age.
_Avoid_: weather data, forecast feed

**Panel**:
A translucent box floating over the map that holds one kind of information (Readings, Alerts, Evacuation Plan, Cameras) and can be collapsed without leaving the map.
_Avoid_: widget, sidebar, column

**Node card**:
One Node's entry in the Readings Panel: its name, tags, water level and the other Community Readings with their trends.
_Avoid_: tile, row, sensor card

**Hub Panel**:
The slide-over on the Hub's dashboard holding the Node registry, the Community Warning log, Shelter status and the Replay controls.
_Avoid_: admin page, settings, control panel

**Breadboard**:
The Pi's board of wires and pins that stands in for sensors on stage: plugging a wire from the 3.3 V rail into an input pin is a press that sets the Scenario to that input's step (pressure drop, rain, water rising), and a fourth input resets it. It moves one Node only, so one bad Node cannot raise a Community Warning alone.
_Avoid_: GPIO panel, controller

**Node Panel**:
The slide-over shown only on a Node's own screen, holding the Scenario controls and that Node's registration status; never shown to Viewers on other devices.
_Avoid_: operator panel, settings, admin

**Join card**:
The card with the two codes a phone scans to join the neighborhood Wi-Fi and then open the dashboard.
_Avoid_: QR, invite, onboarding
