# Wire formats

The messages Nodes exchange over the mesh, the Node HTTP API the dashboard polls, and the Cache Pack file layout. Decided in the UI design grilling; spec: `docs/specs/storm-shield.md`, look and feel: `docs/design/ui.md`. Words follow `CONTEXT.md`. **Changing anything here needs the whole team.**

## Rules for every mesh message

- JSON, UTF-8, one object per message.
- Each message stays **under about 350 bytes**, so it always fits one Reticulum packet (single-packet limit is about 500 bytes, about 380 usable after encryption; ticket 0004 confirms this). Anything bigger is split, never grown.
- Every message has `v` (format version, currently `1`) and `kind`.
- Sender identity and signature come from Reticulum and are checked by the Mesh module before a message reaches anyone else. They are not repeated in the JSON. A message that fails verification is dropped.
- Receivers ignore unknown `kind` values and unknown fields, so a newer Node never crashes an older one.

## Community Reading (`kind: "reading"`)

One message per Sensor Node per tick, all four measurements together.

```json
{ "v": 1, "kind": "reading", "node": "91c2e0b47a3d", "seq": 412, "t": 1760650928,
  "sim": true, "pos": [29.652, -82.325],
  "pressure_hpa": 991.2, "water_m": 0.84, "rain_mmh": 14.8, "soil_pct": 91 }
```

- `node`: the sender's short Reticulum identity (first 12 hex characters). **This 12-character id is the only Node id**: warnings, the registry and the API all use it as is.
- `seq`: counter that goes up by one per reading from that Node. Receivers ignore a `seq` they have already seen, which stops duplicates and old relayed copies.
- `t`: the sender's clock, informational only. **Age is always measured on the receiving Node's own clock** (time since the last accepted reading from that Node), because the Pi has no battery clock.
- `sim`: `true` for a Simulated Reading; it produces the SIMULATED tag.
- `pos`: latitude and longitude already fuzzed by the sender to a grid of about 0.002° (roughly 200 m). The true location never goes on the wire.
- Units are in the field names: `water_m` is metres, `soil_pct` a whole-number percentage. Simulated Readings use these same fields and units inside the Node too; the Node adds `v`, `kind`, `node`, `seq` and `pos` only when it publishes.

### Timing (one config module, tunable)

| Setting | Default |
|---|---|
| Publish every | 3 s (a Scenario step publishes immediately) |
| Node shows STALE | after 15 s of silence |
| Node stops counting toward Flood Risk and Community Warnings | after 60 s of silence |
| Node removed from map and rail (stays in the registry) | after 10 min of silence |

## Community Warning (`kind: "warning"`)

Sent by the Hub only, when two or more Registered Nodes are High.

```json
{ "v": 1, "kind": "warning", "id": 7, "t": 1760650928,
  "nodes": ["b7e1f40a92c5", "91c2e0b47a3d"], "reasons": ["water_high", "rain_heavy"] }
```

- `id`: Hub-issued counter. Used for deduplication and for the once-per-warning modal on each device.
- `nodes`: Node ids, the same 12-character ids readings use; the dashboard looks up names in the registry.
- `reasons`: codes from a small fixed list (`water_high`, `water_rising`, `rain_heavy`, `pressure_falling`). The dashboard writes the sentence.
- There is **no text field**. The "Community Warning · not official" label and the "check official sources for any evacuation decision" line are fixed UI and cannot be dropped or altered by a message.
- Only the Hub identity configured on the receiving Node may send this kind.

## Registry (`kind: "registry"`)

The Hub's list of Registered Nodes. Always a full snapshot.

```json
{ "v": 1, "kind": "registry", "ver": 4, "part": 1, "of": 1, "t": 1760650928,
  "nodes": [ { "id": "b7e1f40a92c5", "name": "garage" }, { "id": "91c2e0b47a3d", "name": "kitchen" } ] }
```

- `ver` goes up on every change; a Node keeps the highest `ver` it has received in full.
- `part` / `of` let a list span several packets (about 6 Nodes per packet at 12-character ids; the demo has 5).
- The Hub republishes the current snapshot every 30 s, so late joiners and Nodes that missed a packet converge.
- A Node not in the latest registry is Unverified: shown greyed out, tagged NOT COUNTED, never counted.

### Hub identity and sign-up

- Each Node learns who the Hub is from config: the Hub prints its Reticulum identity hash at startup and every other Node sets it once as `HUB_IDENTITY` (documented in `.env.example`). Nobody is trusted for announcing themselves as the Hub.
- A Node signs up with one addressed message to the Hub: `{ "v": 1, "kind": "signup", "name": "garage" }`. The Hub operator sees it and accepts it; accepting bumps the registry `ver`.
- If the Hub is restarted with a new identity, every Node's `HUB_IDENTITY` must be updated. Ticket 0004 notes this.

## Official Alert (`kind: "alert"`)

Sent by the Hub only, from the same normalization path for live feeds and the Hurricane Helene replay.

```json
{ "v": 1, "kind": "alert", "id": "helene-004", "source": "county", "mode": "replay",
  "issued": "2024-09-25T15:00:00Z",
  "headline": "Evacuation order: mobile homes, RVs, flood-prone areas",
  "applies_to": ["mobile_home", "rv", "flood_prone_area"],
  "url": "https://[source link]" }
```

- `source`: `nws`, `nhc` or `county`; drives the source tag.
- `mode`: `live` or `replay`. `replay` produces the OFFICIAL · REPLAY label and is never optional.
- `applies_to`: tags the Evacuation Plan reads, so it never parses prose. Empty means the alert covers everyone in the zone. Values: `mobile_home`, `rv`, `flood_prone_area`.
- `issued` is the source's own real timestamp and is displayed as is; it does not go through age logic.
- `headline` is at most 120 characters. Full text stays behind `url`, which opens only when the internet is back.
- Replay alerts are tagged by hand (a recorded event). Live NWS and NHC alerts are tagged only in obvious cases; anything else applies to everyone.

## Shelter status (`kind: "shelters"`)

Details (name, position, special-needs, pet-friendly) live in the Cache Pack. Only open status travels the mesh.

```json
{ "v": 1, "kind": "shelters", "ver": 3, "t": 1760650928, "open": ["sr-center", "hs-gym"] }
```

- `open` lists the ids of Shelters currently open. **Nothing counts as open until listed.**
- `ver` and the 30 s republish work as for the registry.
- A Shelter that was in the previous snapshot and is gone now shows as closed. If none are open, the plan says "No open Shelter announced yet. Follow official sources." and draws no route.
- Shelter ids are short slugs fixed in the Cache Pack.

## Flood Risk is not a message

Every Node computes Flood Risk from the Community Readings it holds plus the registry. The Hub computes each Registered Node's risk the same way to decide when to issue a warning. Thresholds stay deferred until the Node backend exists.

## Node HTTP API (dashboard seam)

The dashboard polls **one snapshot** every second and shows "Node unreachable" if it stops answering. This replaces the server-sent events in the spec's Node HTTP API paragraph.

**Until `/api/state` exists** (it grows ticket by ticket), `GET /api/readings` returns a list of Community Readings in the shape above, minus the publish-time fields: one entry for this Node now, one per Node once ticket 0003 lands. The dashboard polls it every second.

- `GET /api/state` returns everything the screen needs in one consistent object: this Node's identity, role and `online` / `mesh_only` status; readings (with `registered`, `stale`, `age_s` and `sim`); Flood Risk with reason codes; Official Alerts; verified Community Warnings only; Shelter open ids; Scenario step.
- Actions are small POSTs: `POST /api/scenario/step`, `POST /api/scenario/reset`, and on the Hub `POST /api/registry/accept` and `POST /api/shelters/open`.
- The Household Profile never touches the API; it stays in the Viewer's browser.
- Viewers cannot check Reticulum signatures, so the Node serves only warnings whose Hub signature verified. The dashboard never sees an unverified one.

## Cache Pack (a file, not a mesh message)

Built by a script ahead of the event. The Hub downloads it while online; other Nodes fetch it from the Hub over the local Wi-Fi, never over the mesh.

```
cache-pack.zip
├── manifest.json         { "v": 1, "built": "...", "bbox": [...], "files": { "<path>": "<sha256>" } }
├── shelters.json         [ { "id": "sr-center", "name": "...", "pos": [lat, lon],
│                             "special_needs": true, "pet_friendly": false } ]
├── flood_prone.geojson   FEMA flood zones plus the Hogtown Creek and Sweetwater Branch floodplains
├── tiles/{z}/{x}/{y}.png dark map tiles for the neighborhood (credit shown on the map)
└── routes/{gx}_{gy}.json { "<shelter id>": [[lat, lon], ...] }   one file per grid cell
```

- The route grid is a fixed spacing (about 100 m). A home snaps to the nearest cell and the plan loads only that file.
- Polylines use 5 decimal places.
- The Node checks the checksums in `manifest.json` and refuses an incomplete or corrupt pack.
