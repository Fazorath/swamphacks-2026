# Wire formats

The messages Nodes exchange over the mesh, the Node HTTP API the dashboard polls, and the Cache Pack file layout. Decided in the UI design grilling; spec: `docs/specs/storm-shield.md`, look and feel: `docs/design/ui.md`. Words follow `CONTEXT.md`. **Changing anything here needs the whole team.**

## Rules for every mesh message

- JSON, UTF-8, one object per message.
- Each message stays **under about 350 bytes**, so it always fits one Reticulum packet (single-packet limit is about 500 bytes, about 380 usable after encryption; ticket 0004 confirms this). Anything bigger is split, never grown.
- Every message has `v` (format version, currently `1`) and `kind`.
- Reticulum does not say who sent a data packet, so every message is **signed by the sending Node** with its Reticulum identity: the packet is the 64-byte signature followed by the JSON. The Mesh module checks it against the public key it learned from that Node's announce (sent on start and every 10 s) before a message reaches anyone else, and drops it if the Node has not announced yet, the signature fails, or the JSON is not a message. The signature is not repeated in the JSON, and the 12-character `node` id inside it must match the key that signed it. The signature counts toward the packet limit below (about 465 bytes unencrypted).
- Receivers ignore unknown `kind` values and unknown fields, so a newer Node never crashes an older one.

## Community Reading (`kind: "reading"`)

One message per Sensor Node per tick, all four measurements together.

```json
{ "v": 1, "kind": "reading", "node": "91c2e0b47a3d", "seq": 412, "t": 1760650928,
  "sim": true, "pos": [29.652, -82.325], "river_km": -12.2,
  "pressure_hpa": 991.2, "water_m": 0.84, "rain_mmh": 14.8, "soil_pct": 91 }
```

- `node`: the sender's short Reticulum identity (first 12 hex characters). **This 12-character id is the only Node id**: warnings, the registry and the API all use it as is.
- `seq`: counter that goes up by one per reading from that Node. It starts at 0 at startup. While the last reading accepted from a Node is fresh (heard no more than 15 s ago on the receiver's own clock), receivers ignore a `seq` that is not higher than the last one accepted, which stops duplicates and old relayed copies. Once that Node has been silent for more than 15 s, any `seq` is accepted, so a Node that restarts with a wrong clock or a counter back at 0 is heard again (ticket 0022). Ignored readings do not refresh the Node's age.
- `t`: the sender's clock, informational only. **Age is always measured on the receiving Node's own clock** (time since the last accepted reading from that Node), because the Pi has no battery clock.
- `sim`: `true` for a Simulated Reading; it produces the SIMULATED tag.
- `pos`: latitude and longitude already fuzzed by the sender to a grid of about 0.002° (roughly 200 m). The true location never goes on the wire.
- `river_km`: the operator's `NODE_RIVER_KM`, or `null`. The Hub reads it from the surging Node's reading to fill a warning's `origin_km`; a Node without it can surge but starts no warning (ticket 0013).
- Units are in the field names: `water_m` is metres, `soil_pct` a percentage. A Node may hold readings in another shape internally; the conversion happens where a message is built or received.

### Timing (one config module, tunable)

| Setting | Default |
|---|---|
| Publish every | 3 s (a Scenario step publishes immediately) |
| Node shows STALE | after 15 s of silence |
| Node stops counting toward Flood Risk and Community Warnings | after 60 s of silence |
| Node removed from map and rail (stays in the registry) | after 10 min of silence |

## Community Warning (`kind: "warning"`)

Sent by the Hub only, once per Registered Node's Surge (ticket 0013; it was two or more Registered Nodes High). The example below is the original shape; `origin`, `origin_km` and `surge_t` are added under "Flash flood additions".

```json
{ "v": 1, "kind": "warning", "id": 7, "t": 1760650928,
  "nodes": ["b7e1f40a92c5", "91c2e0b47a3d"], "reasons": ["water_high", "rain_heavy"] }
```

- `id`: Hub-issued counter. Used for deduplication and for the once-per-warning modal on each device.
- `nodes`: Node ids, the same 12-character ids readings use; the dashboard looks up names in the registry.
- `reasons`: codes from a small fixed list (`water_surge`, `water_high`, `water_rising`, `rain_heavy`, `pressure_falling`). The dashboard writes the sentence.
- There is **no text field**. The "Community Warning · not official" label and the "check official sources for any evacuation decision" line are fixed UI and cannot be dropped or altered by a message.
- Only the Hub identity configured on the receiving Node may send this kind.

## Registry (`kind: "registry"`)

The Hub's list of Registered Nodes. Always a full snapshot.

```json
{ "v": 1, "kind": "registry", "ver": 4, "part": 1, "of": 1, "t": 1760650928,
  "nodes": [ { "id": "b7e1f40a92c5", "name": "garage" }, { "id": "91c2e0b47a3d", "name": "kitchen" } ] }
```

- `ver` goes up on every change; a Node keeps the highest `ver` it has received in full.
- `part` / `of` are reserved for a list that spans several packets. **For now the Hub always sends `part: 1, of: 1`** and refuses an accept (409) that would no longer fit one signed packet; receivers ignore a registry with `of` above 1 (decided 2026-10-17, ticket 0012).
- The Hub always lists itself. It saves `ver` and the list in `NODE_DATA_DIR/registry.json` and starts every restart at saved `ver` + 1, as for Shelter status. With no file (first start, or the file deleted) it starts at the current Unix time, so a Hub that starts over still beats the `ver` running Nodes hold.
- The Hub republishes the current snapshot every 30 s, so late joiners and Nodes that missed a packet converge.
- A Node not in the latest registry is Unverified: shown greyed out, tagged NOT COUNTED, never counted. Before any registry has arrived every Node is Unverified, this one included, and nothing counts.

### Hub identity and sign-up

- Each Node learns who the Hub is from config: the Hub prints its Reticulum identity hash at startup and every other Node sets it once as `HUB_IDENTITY` (documented in `.env.example`). Nobody is trusted for announcing themselves as the Hub.
- A Node signs up with a broadcast message, signed by the Node like a reading: `{ "v": 1, "kind": "signup", "node": "91c2e0b47a3d", "name": "garage" }`. It carries `node` because the Mesh has no addressed send and checks every kind without a `node` against the Hub key. Nodes other than the Hub ignore it. The Hub operator sees it and accepts it; accepting bumps the registry `ver` (changed from "one addressed message" on 2026-10-17, ticket 0012).
- If the Hub is restarted with a new identity, every Node's `HUB_IDENTITY` must be updated. Ticket 0004 notes this.

## Official Alert (`kind: "alert"`)

Sent by the Hub only. Today every alert is a replayed DHM or district alert from `replay_timeline.json` (0014); live feeds were dropped with ticket 0017.

```json
{ "v": 1, "kind": "alert", "id": "dhm-sms", "source": "dhm", "mode": "replay",
  "issued": "2026-08-26T09:15:00+05:45",
  "headline": "SMS to riverbank residents of Rasuwa, Nuwakot, Dhading and Chitwan: remain on high alert",
  "applies_to": ["flood_prone_area"],
  "url": "https://kathmandupost.com/national/2026/08/27/how-the-bhotekoshi-flood-unfolded-over-10-hours" }
```

- `source`: `dhm`, `ndrrma` or `district`; drives the source tag.
- `mode`: `live` or `replay`. `replay` produces the OFFICIAL · REPLAY label and is never optional.
- `applies_to`: tags the Evacuation Plan reads, so it never parses prose. Empty means the alert covers everyone in the zone. Values: `mobile_home`, `rv`, `flood_prone_area`.
- `issued` is the source's own real timestamp and is displayed as is; it does not go through age logic.
- `headline` is at most 120 characters. Full text stays behind `url`, which opens only when the internet is back.
- Replay alerts are tagged by hand (a recorded event).
- **Replay timing.** The Hub sends a replayed alert once its Event clock reaches `issued` (checked every `NODE_ALERT_CHECK_SECONDS`, default 1 s) and repeats every alert already due with each Event clock repeat. A Node shows a replayed alert only while its own Event clock is at or past `issued`, so a reset or a jump back hides it again without a new message. A signed alert must fit one Reticulum packet (464 bytes), which bounds `headline` and `url` together.
- `GET /api/state` carries the alerts this Node shows as `official_alerts`, oldest first.

## Shelter status (`kind: "shelters"`)

Details (name, position, special-needs, pet-friendly) live in the Cache Pack. Only open status travels the mesh.

```json
{ "v": 1, "kind": "shelters", "ver": 3, "t": 1760650928, "open": ["sr-center", "hs-gym"] }
```

- `open` lists the ids of Shelters currently open. **Nothing counts as open until listed.**
- `ver` and the 30 s republish work as for the registry.
- A Shelter that was in the previous snapshot and is gone now shows as closed. If none are open, the plan says "No open Shelter announced yet. Follow official sources." and draws no route.
- Shelter ids are short slugs fixed in the Cache Pack.

## Flash flood replay additions

From `docs/specs/flash-flood-replay.md`; decided by the team on 2026-10-17. The `replay` message is built (0044), the `alert.source` values (0014) and the `warning` additions (0013).

- **Community Warning** gains `origin` (the surging Node's id), `origin_km` (its River km) and `surge_t` (event time of the Surge, Unix seconds), and the reason code `water_surge`. It is sent when one Registered Node reports a Surge, not when two are High.

  ```json
  { "v": 1, "kind": "warning", "id": 7, "t": 1760650928, "nodes": ["b7e1f40a92c5"],
    "reasons": ["water_surge"], "origin": "b7e1f40a92c5", "origin_km": -12.0, "surge_t": 1787716020 }
  ```
- **Community Warning `measured`** (optional, ticket 0050): once a second Registered Node downstream of the origin has surged, the Hub sends the same warning (same `id`) again with `"measured": { "node": "91c2e0b47a3d", "km": 1.6, "surge_t": 1787716740, "speed_kmh": 78.0 }`. `node` and `km` are the second Node and its River km, `surge_t` its Surge event time. Receivers replace their copy by `id`; it is not a new warning.
- **Replay clock** (`kind: "replay"`), Hub only, sent on every change and every 10 s:

  ```json
  { "v": 1, "kind": "replay", "state": "playing", "event_t": 1787716020, "rate": 30 }
  ```

  `state` is `playing`, `paused` or `stopped`. `event_t` is the event time when the message was sent; a receiver anchors it on its own clock at receipt, like reading age.
- **Node API (until `/api/state`, 0019, carries it):** `GET /api/replay` returns the Event clock as this Node counts it (`state`, `event_t` now, `rate`), and on the Hub `POST /api/replay/start` starts the replay from 08:30 and announces it. A Sensor with a replay track (`NODE_REPLAY_TRACK`) plays it only while the clock is `playing` or `paused`, and publishes nothing once the track's `silent_at` has passed.
- **Official Alert** `source` gains `dhm`, `ndrrma` and `district`.
- **Cache Pack** gains `river.geojson`: the river line with River km along it and a wave speed (km/h) for each reach.

## Flood Risk is not a message

Every Node computes Flood Risk from the Community Readings it holds plus the registry. The Hub computes each Registered Node's risk the same way to decide when to issue a warning. In calm weather there is no Flood Risk, so the level in the API is `null` and the reasons list is empty. Thresholds live in one module on the Node (first pass in ticket 0006).

## Node HTTP API (dashboard seam)

The dashboard polls **one snapshot** every second and shows "Node unreachable" after 5 s with no good answer. This replaces the server-sent events in the spec's Node HTTP API paragraph.

`/api/state` grows ticket by ticket. `GET /api/node`, `/api/readings`, `/api/readings/stream`, `/api/flood-risk` and `GET /api/scenario` no longer exist and answer 404.

- `GET /api/state` returns everything the screen needs in one consistent object. Today: this Node's `id`, `name`, `role` and `online` / `mesh_only` `status`; the Scenario step (`scenario: {step}`); `flood_risk` (level, reasons with codes, Storm Signal, per-Node levels); and `nodes`, one entry per Node heard, this one included, sorted by `id`: `{id, position, simulated, age_s, stale, measurements, registered, name}` (`name` is the registry name, `null` when Unverified), where `measurements` is keyed by kind (`pressure`, `rain_rate`, `water_level`, `soil_moisture`) with `{value, unit}`. `stale` is decided by the Node (silent for more than 15 s). `official_alerts` (see Official Alerts above). The top level also has `registration` (`unverified`, `waiting` or `registered`; the Hub is always `registered`). It also carries `community_warnings` (the verified ones only), and `fleet`, the Simulated Fleet from this Node's Cache Pack (ticket 0064), sorted by `id`: `{id, name, river, site, position, age_s, stale, measurements}`, with `measurements` shaped as in `nodes`. `fleet` is `[]` when the pack has no fleet file; nothing reads it but the map. Open Shelter ids are not in the snapshot; they come from `GET /api/shelters`.
- Actions are small POSTs: `POST /api/scenario/step`, `POST /api/scenario/reset`, and on the Hub `POST /api/registry/accept` and `POST /api/shelters/open`.
- The Household Profile never touches the API; it stays in the Viewer's browser.
- Viewers cannot check Reticulum signatures, so the Node serves only warnings whose Hub signature verified. The dashboard never sees an unverified one.

## Cache Pack (a file, not a mesh message)

Built by a script ahead of the event. The Hub downloads it while online; other Nodes fetch it from the Hub over the local Wi-Fi, never over the mesh.

```
cache-pack.zip
├── manifest.json         { "v": 1, "built": "...", "bbox": [...], "route_grid": { "south", "west", "lat_step", "lon_step" }?, "files": { "<path>": "<sha256>" } }
├── shelters.json         [ { "id": "sr-center", "name": "...", "pos": [lat, lon],
│                             "height_above_river_m": 96, "special_needs": true, "pet_friendly": false } ]
├── flood_prone.geojson   the river corridor (Lende Khola, Bhote Koshi, Trishuli), approximate
├── river.geojson         the river line: one LineString per reach, with "speed_kmh", "km" (River km at each vertex) and "source"
├── weather_replay.json   the recorded weather of 25 to 27 Aug 2026 as a Weather Grid (below); packs built before the Weather layers lack it
├── fleet.json            the Simulated Fleet (below); packs before v4 lack it
├── nepal/border.geojson     the country border (geoBoundaries ADM0); v4 packs onward
├── nepal/districts.geojson  the 75 districts, `{ "name" }` (geoBoundaries ADM2)
├── nepal/rivers.geojson     OpenStreetMap rivers in Nepal, `{ "name": str|null, "main": "Koshi"|"Gandaki"|"Karnali"|"Mahakali"|"Bhote Koshi–Trishuli"|null }`
├── nepal/places.geojson     cities and towns of Nepal, plus villages and hamlets in the valley box, `{ "name", "kind" }`
├── elevation/{z}/{x}/{y}.png  Terrarium elevation tiles: zoom 5 to 8 over Nepal, zoom 9 to 12 over the valley box
├── tiles/{z}/{x}/{y}.png dark map tiles for the valley, zoom 10 to 14 (credit shown on the map); v4 leaves them out
├── roads.json            the Road graph, only when built: { "nodes": [[lat, lon], ...], "edges": [[a, b, length_m, [[lat, lon], ...]?], ...] }
└── routes/{gx}_{gy}.json { "<shelter id>": [[lat, lon], ...] }   one file per grid cell, only when Routes are built
```

- `bbox` is `[south, west, north, east]`, the demo box the pack covers.
- A v4 pack adds a `nepal` entry to the manifest: `{ "bbox": [...] (Nepal), "elevation": { "encoding": "terrarium", "national_zooms": [5, 8], "valley_zooms": [9, 12], "valley_bbox": [...] }, "boundaries_note": "Boundaries are indicative", "sources": [ { "layer", "name", "licence", "url", "checked" } ] }`. The files above are listed with their checksums like any other, and the Node serves them at `/api/cache-pack/files/<path>`. A pack without them (v3 and earlier) has no `nepal` entry and the map falls back to the river line and corridor it has. Terrarium encodes metres as `(r * 256 + g + b / 256) - 32768`.
- A valley pack built without `--roads-pbf` has no `route_grid` and no `routes/` (the plan works without them). When Routes are built (ticket 0051), a Route that crosses the Flood-Prone Area is left out of its file, and the grid spacing is 100, 250 or 500 m, the finest that fits the 5 MB budget (before that, about 100 m; `route_grid` in the manifest gives the origin and steps). Cell `gx = round((lon - west) / lon_step)`, `gy = round((lat - south) / lat_step)`, rounding halves up. A home snaps to the nearest cell and the plan loads only that file; a cell with no file has no Routes. A route runs from the Grid point to the Shelter.
- `roads.json` lists junctions and bends as `nodes`; an `edge` joins node indexes `a` and `b` in both directions (a one-way road is treated as two-way: a resident on foot or in a hurry ignores it), with `length_m` along the road and an optional list of in-between vertices to draw. Service roads are left out; the file stays under about 2 MB.
- Polylines use 5 decimal places.
- The Node checks the checksums in `manifest.json` and refuses an incomplete or corrupt pack.

### Weather Grid (`weather_replay.json`, and later the Hub's forecast file)

One file, the same shape for the recorded weather and the forecast. Fixed in ticket 0052; spec: `docs/specs/weather-layers.md`.

```
{
  "source": "Open-Meteo archive (reanalysis), roughly 10 to 25 km per cell",
  "credit": "Weather data by Open-Meteo.com (CC BY 4.0)",
  "grid":   { "south": 27.86, "west": 85.08, "rows": 7, "cols": 5, "step_deg": 0.1 },
  "times":  ["2026-08-25T00:00Z", "2026-08-25T01:00Z", ...],
  "units":  { "temperature_2m": "°C", "cloud_cover": "%", "precipitation": "mm/h", "wind_speed_10m": "m/s", "wind_direction_10m": "°" },
  "variables": { "temperature_2m": [[...], ...], "cloud_cover": ..., "precipitation": ..., "wind_speed_10m": ..., "wind_direction_10m": ... }
}
```

- `grid` gives the south-west corner, the number of rows (south to north) and columns (west to east) and the spacing in degrees. Point `(row, col)` is at `south + row * step_deg`, `west + col * step_deg`. These are the coordinates we asked for, not the ones Open-Meteo reports for its model cell. The grid covers the pack box and may run up to one step past its north and east edges (the valley file ends at 85.48 E, box edge 85.47).
- `times` are hourly, UTC, ISO 8601 with a `Z`. The recorded file holds 72 hours (25 to 27 Aug 2026; 08:37 NPT on the 26th is `2026-08-26T02:52Z`).
- Each variable is a list with one flat array per entry of `times`, each of `rows * cols` numbers in row-major order (index `row * cols + col`). The wind direction is where the wind blows from, in degrees clockwise from north. Precipitation is the hour's total, so mm/h.
- The values are reanalysis at model resolution: context for the valley, not a measurement at a village.
- `GET /api/weather/replay` serves the file from the Cache Pack, or answers 404 with a message when this Node's pack has none. The manifest lists its checksum like any other file, so a wrong one discards the whole pack.
- `GET /api/weather/forecast` serves the Hub's forecast in the same shape plus `fetched_at` (ISO 8601, when the Hub fetched it), or 404 when this Node has none. The Hub writes it to `weather_forecast.json` in `NODE_DATA_DIR` once an hour from `api.open-meteo.com/v1/forecast` (7 days, same grid), keeping the last good copy; a Sensor downloads it from `NODE_WEATHER_FORECAST_URL` (the Hub's route) and keeps its own copy. A damaged file counts as absent.

### Simulated Fleet (`fleet.json`)

Decided in the 0064 grill on 2026-10-18; spec: `docs/specs/gods-eye-view.md`. The builder may rename fields, keeping the meaning.

```
{
  "source":  "positions: fleet.source.json (OpenStreetMap, checked 2026-10-..); weather: Open-Meteo archive",
  "credit":  "Weather data by Open-Meteo.com (CC BY 4.0)",
  "water_model": "water level modelled from Open-Meteo rainfall: base_cm + gain * rain of the previous 24 h",
  "start_t": 1787712300, "step_s": 30,
  "units": { "water_level": "cm", "rain_rate": "mm/h", "soil_moisture": "%", "pressure": "hPa" },
  "entries": [
    { "id": "fleet-chisapani", "name": "Chisapani", "river": "Karnali", "site": "town", "pos": [28.644, 81.276],
      "silent_at": null,
      "track": { "water_level": [...], "rain_rate": [...], "soil_moisture": [...], "pressure": [...] } }
  ]
}
```

- `start_t` is 08:30 NPT on 26 Aug 2026 in event time; point `i` of every track is at `start_t + i * step_s`, through 10:30. Units are those of `measurements` (cm, mm/h, %, hPa).
- `site` is `town` or `headwater`. `silent_at` (event time) is set on one town site only; its track ends there, so past it the entry keeps its last point and ages.
- A Node serves the reading at the last point at or before its Event clock; with no Replay heard, point 0. `age_s` is `(event_now − last_point_t) / rate`, frozen while the clock is paused or stopped.
- Ids are `fleet-<slug>`, never shaped like a Node id. The manifest lists the file's checksum like any other.
