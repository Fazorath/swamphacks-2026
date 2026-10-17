# Storm Shield

A neighborhood disaster dashboard for Gainesville / Alachua County, Florida. Community sensor readings are shared over a local mesh, so residents keep seeing conditions and their evacuation plan when the internet goes down. It adds hyperlocal ground truth next to official NWS/NHC information; it never replaces it.

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

**Relay Node**:
A Node that passes Community Readings along and keeps a copy, without producing its own.
_Avoid_: repeater, hop

**Hub**:
The one Node that collects every Community Reading, issues Community Warnings and hosts the central dashboard; when it has internet it also brings Official Alerts and the Cache Pack into the Mesh.
_Avoid_: gateway, central server, cloud, backend

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
A scripted storm sequence (normal day, pressure drop, rain, water rising) that produces Simulated Readings, stepped forward by breadboard buttons.
_Avoid_: demo script, simulation, playback

**Official Alert**:
A warning or order issued by NWS, NHC or Alachua County, shown distinctly from community information.
_Avoid_: warning, notification

**Community Warning**:
A signed warning issued by Storm Shield from Community Readings; never an evacuation order, and always points residents to official sources for evacuation decisions.
_Avoid_: alert, alarm, evacuation notice

**Cache Pack**:
The bundle of offline information (Shelters, Flood-Prone Areas, map tiles, and later precomputed routes) built once by a script, then downloaded by every Node while online and served from its own disk so it works without internet. The Hub gets it from a GitHub Release (or a laptop serving the zip while the repo is private); sensor Nodes get it from the Hub.
_Avoid_: offline data, bundle, snapshot

**Flood Risk**:
A community estimate of flooding danger (Low, Elevated or High) that every Node derives from the Community Readings it can see. It is shown only while it is raining or the Storm Signal is on; in calm weather no Flood Risk is shown at all, not even Low.
_Avoid_: flood score, danger level, threat level

**Raining**:
The condition, judged across the Mesh and not from any single Node, that soil moisture is rising at two or more of the Nodes that count (or at the only one that counts). It is what lets Flood Risk appear as Low.
_Avoid_: wet weather, precipitation

**Storm Signal**:
The dashboard indicator that air pressure is low across the Nodes that count, a sign a storm is approaching. It stays on while pressure stays low and is separate from Flood Risk, though it makes Flood Risk appear (as Low) when nothing else would.
_Avoid_: storm warning, storm alert, pressure alarm

## Evacuation

**Evacuation Plan**:
What a resident should do and where to go: their risk, the nearest open Shelter, and a route to it.
_Avoid_: evac info, escape route

**Household Profile**:
A resident's home location, housing type (site-built or mobile home/RV), and whether they need a special-needs or pet-friendly Shelter; kept only on their own device.
_Avoid_: user profile, account, settings

**Shelter**:
A public building opened by the county to house evacuees during a storm.
_Avoid_: refuge, safe place

**Flood-Prone Area**:
Land approximated from FEMA flood zones and creek floodplains; Alachua County has no lettered evacuation zones.
_Avoid_: evacuation zone, surge zone

## Dashboard

**Warning Takeover**:
The full-screen modal that interrupts any view when a new Official Alert or Community Warning arrives, with one large acknowledge button; acknowledging it on one device never clears it on another.
_Avoid_: popup, alarm, klaxon, notification

**Stale**:
A Node whose last Community Reading arrived more than 15 seconds ago by the receiving Node's own clock; after 60 seconds its readings stop counting toward Flood Risk. The age is shown on the Node's map marker and Readings card.
_Avoid_: offline node, dead node, timed out

**Hub Panel**:
The slide-over on the Hub's dashboard holding the Node registry, the Community Warning log, Shelter status and the live or replay switch for Official Alerts.
_Avoid_: admin page, settings, control panel
