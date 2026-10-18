# Dashboard UI design

How the Storm Shield dashboard looks, where things go and how it moves. **The visual source of truth is the design canvas: https://claude.ai/artifact/722U2tKJ78hvbbbNUnx2dQ**, organized in five pages: Foundations, Components, Desktop, Phone and Flows. Build from it; if a view or state is missing, add an artboard there first (see "Changing the design").

**Agents: build from the copy in this repo, `docs/design/canvas/`.** The online canvas is private and other accounts' agents cannot read its markup. Each `<name>.dc.html` there is one artboard as plain HTML; `canvas.json` lists every artboard with its title and page; `theme.css` holds every color role and component style. Prefixes: `F-` Foundations, `C-` Components, `D-` Desktop screens, `P-` Phone screens, `Flow-` Flows; `Main.dc.html` is the cover with the view-to-ticket index. Tickets name the artboards they build from. When the canvas changes, refresh this copy in the same commit. Message and API shapes: `docs/specs/wire-formats.md`. Spec: `docs/specs/storm-shield.md`. Words follow `CONTEXT.md`.

## Reference

The look is borrowed from [Osiris](https://github.com/simplifaisoul/osiris) ([osirisai.live](https://osirisai.live)), an open-source (MIT) OSINT dashboard that layers cameras, weather and satellite data on one map. Keep its license notice in anything copied from it, and never copy its `stealthFetch` (it forges request headers).

What we take from it:

- **The map is the page.** It fills the screen; everything else floats over it.
- **A Layer rail with live counts** on the left edge.
- **Translucent Panels** over the map that slide in and collapse.
- **Marker anatomy:** glow, outlined dot, label.
- **Stock Lucide icons** whose brightness shows on or off, and a pulse ring for fresh information.
- **Freshness badges** and an **OFFLINE** state when a source is down.

What we leave out: the 40 layers, globe, AI analyst, finance, cyber, and its gold controls (they collide with Elevated amber). Storm Shield has one country and one storm.

We take its structure as inspiration, not its code: only its small terrain helpers are ported, under its MIT notice (ADR 0005).

## God's Eye View (desktop)

On desktop, the projector and judges' laptops, the map is a Nepal-only God's Eye View: a dark, instant MapLibre vector map with slight 3D terrain, about 40 Simulated Fleet Nodes in green along the rivers, the valley Nodes and the real Nodes standing out, and the flood wave running down the river. Spec: `docs/specs/gods-eye-view.md`; decision: ADR 0005; the visual decisions `D-01` to `D-55` are in `docs/design/gods-eye-view-decisions.md` and are final. Where this section and the sections below differ on the desktop map, markers, Panels, Readings Panel or Warning Takeover, this section wins; the phone layout is unchanged until 0036. The God's Eye View artboards are still to be drawn on the canvas; until then this section and the decisions file are the design.

- **Basemap (D-01 to D-07):** drawn from vector data in the Cache Pack in theme roles; no raster tiles, no run-time requests. Osiris's look lifted one step for the projector (ground `navy-900`, outside `navy-925`, labels `ink-300`), land lifted two steps with rivers in `river-300` and the border in `ink-400`. District hairlines only past the national zoom. Rivers from OpenStreetMap geometry, the four main rivers and the Bhote Koshi–Trishuli named. National-zoom labels: Kathmandu and the four valley towns only. Hillshade faint (about 10%). Credits, "Boundaries are indicative" and "elevation approximate" always shown.
- **3D (D-30 to D-35):** pitch 45°, exaggeration 1.5×, valley walls in height bands (hypsometric tint). Manual zooming stays flat; the map tilts only on the warning's camera fly (and a Valley button). A segmented `2D | 3D` control bottom-left, above the legend; when terrain drops itself to 2D the status strip says "Terrain off · frame rate" in amber mono and nothing else moves.
- **Legend (D-39):** a small glass box bottom-left beside the rail's foot, above the 2D / 3D switch: green dot, REAL ring, Stale grey, wave white, the Simulated badge.
- **Fleet (D-38, D-40 to D-42):** one quiet badge, "40 simulated Nodes · 6 real" (live counts), first in the status strip and in the legend, with the sources and check dates in its hover tooltip. The Fleet toggle is a rail button with the count as its badge. A fleet Node clicked on the map opens a popover beside its dot (the one exception to "no popups"); it carries `SIMULATED`.
- **Markers (D-06, D-08 to D-15, D-52, D-53):** glow, outlined dot, label; the full table is in the spec. Valley and real Nodes: 10 px dot, labels always on. Fleet: labels on hover or zoom; at the national zoom the fleet shrinks to 5 px points with no labels, interpolated with the zoom so nothing pops. Green (`green-400`) means healthy and is flat; only Elevated (amber, 16 px glow) and High (red, 22 px glow) glow. Real Nodes: a 1.5 px white ring and the `REAL` tag. A risk rise: a ring expands once on the map and the card flashes on the same frame. Contact lost: the glow dies and a grey arc drains over 10 s, `CONTACT LOST` under the label, a small pulse, and a status-strip note; Stale at 15 s is grey with the last reading struck through and `STALE · age`; a Node heard again fades back in over 300 ms and the strip says so.
- **Wave (D-16 to D-21):** a white comet with a trail fading over the last 15 km, on the Event clock at the reach speeds. A passed Node flashes white for about 2 event minutes, then follows its real state; a town's label turns wave-white with the arrival time beside it, kept. Other rivers: slow drifting dashes.
- **Warning on the God's Eye View (D-22 to D-29, D-55):** the origin Node flashes with its ring, the band slides in and the chime plays. The band is at the top, 120 px, 12% violet tint with the dashed edge, no button; its border pulses twice over 3 s with the two notes. The camera flies flat to the Surging Node, then tilts over 1.5 s. The Wave ETA is a corner card bottom-right beside the Panels, number at 120 px, the town as its label, made to read as critical danger; white, amber under 15 min, red under 5 and "wave expected now" in red. Acknowledge is in the Alerts Panel only; afterwards a violet dashed chip "WARNING · 35 MIN" sits beside the Flood Risk chip and reopens the card, and no banner is shown. The map is never dimmed.
- **Top bar (D-48):** logo, Event clock, Flood Risk chip, Online / Mesh-only pill, Hub button; the Node name moves to the status strip. **Status strip (D-49):** Simulated badge first, then freshness and the Node name, credit at the right.
- **Panels (D-50, D-51):** Readings left; Alerts and the Evacuation Plan right, Cameras third on the right. Calm: Readings only, the Evacuation Plan Panel hidden. Warning: Alerts and the Plan open.
- **Readings Panel (D-36, D-37, ticket 0070):** variant C, a river ladder by River km: valley Nodes in river order on a vertical river line with the wave's position marked between them, real Nodes off the river listed under it, the breadboard Pi's card pinned at the top with a cyan `LIVE SENSORS` tag.
- **High ground (D-43 to D-45):** a chevron-up pin, smaller than a Shelter pin, "90 m up · 11 min walk", shown only when the plan says higher ground, the nearest one with a cyan outline.
- **Rising water, stretch (D-46, D-47):** a dashed `river-300` height line either side of the river with a tick every metre; `RECONSTRUCTION` on the water and as a status-strip line.

## Which views get built

| Group | Views |
|---|---|
| **Must build (on stage)** | Resident Normal day, Raining, Elevated, Storm, Mesh-only; Warning Takeover; Phone Map, Readings, Alerts and Plan tabs; Phone Route |
| **Simple but real** | Loading, empty and error states; Phone Household Profile; Hub Panel (Registry, Warnings, Shelters, Feeds); Node Panel (Scenario, registration); Join card |
| **Stretch** | "Mark road blocked" / "Find another route" (0018), enlarging a camera tile |

The breadboard drives the Scenario on stage; the Node Panel's stepper is for laptops and rehearsal.

## Layout

### Desktop (900 px and wider, after scaling)

```
┌────────────────────────────────────────────────────────────────────┐
│ ◇ Storm Shield  porch · Hub    [FLOOD RISK · HIGH] [STORM SIGNAL]  │  top bar
│                                     ● Mesh-only  [⌂] [Node] [Hub]  │
├────────────────────────────────────────────────────────────────────┤
│ acknowledged-warning banners (when any)                            │
├──┬─────────────┬──────────────────────────────────┬────────────────┤
│▣ │ Readings    │                                  │ Alerts         │
│▣3│ Panel       │          MAP (full bleed,        ├────────────────┤
│▣ │             │          under everything)       │ Evacuation     │
│▣2│             │                                  │ Plan           │
│▣ │             │                                  │                │
├──┴─────────────┴──────────────────────────────────┴────────────────┤
│ readings 1 s · alerts 40 s · Cache Pack v3 · cameras live          │  status strip
└────────────────────────────────────────────────────────────────────┘
  ▲ Layer rail
```

- **The map fills the viewport** under the top bar and above the status strip; Panels float over it. Sizes below are CSS pixels before the 120% zoom, so a 1440 × 900 screen is laid out at 1200 × 750. With one Panel open per side, about 40% of the width stays clear map.
- **Layer rail** on the far left. Nine buttons, one visual treatment, brightness showing on or off:

  | Button | Kind | Count badge |
  |---|---|---|
  | Nodes | map layer | Registered Nodes |
  | Readings | Panel | none |
  | Flood-Prone Areas | map layer | none |
  | Shelters | map layer | open Shelters |
  | Route | map layer | none |
  | Storm Signal | map layer | none |
  | Weather | map layer, one of Temperature / Cloud cover / Rain / Off, draped on the terrain (`docs/specs/weather-layers.md`) | none |
  | Cameras | Panel | live cameras |
  | Alerts | Panel | unacknowledged warnings |

  The Evacuation Plan Panel opens from the Household button in the top bar.
- **Panels** float over the map: Readings docks on the left next to the rail (288 px); Alerts, Evacuation Plan and Cameras stack on the right (336 px). At most two Panels are open per side; opening a third collapses the oldest. Each Panel has a collapse chevron, and which Panels are open is remembered per device. Opening a Panel re-centers the map so the selected Node is never hidden.
- **Default open Panels:** on a calm day, Readings and Evacuation Plan; once there is a Flood Risk of Elevated or High or any Alert, Alerts and Evacuation Plan. On the desktop God's Eye View the calm default is Readings alone and the Plan stays hidden until a warning (D-51, see above).
- **Top bar:** left, logo then Node name and role (`porch · Hub`); center, the mesh-wide Flood Risk chip and, when on, the Storm Signal pill; right, the Online / Mesh-only pill, the Household icon button, the Node button (only on the Node's own screen) and the Hub button (only when the role is Hub).
- **Status strip:** freshness per source: readings age, Official Alerts last fetch, Cache Pack version, cameras live or offline. Mesh-only says so here too.
- Tablets get the desktop layout with one Panel open per side.

### Phone (under 900 px)

- Four bottom tabs: **Map** (default), **Readings**, **Alerts**, **Plan**; 44 px minimum touch targets everywhere.
- Top bar keeps only the logo, the Flood Risk chip and the connection pill.
- **Map tab:** the map, the risk chip, the most recent Alert pinned above the tab bar, and a bottom sheet that peeks at the selected Node.
- **Readings tab:** the Node cards, then the Cameras. **Alerts tab:** Official cards, then Community cards. **Plan tab:** Household Profile, then the Evacuation Plan, then the Route.

## Map

- Dark vector basemap from the Cache Pack (see "God's Eye View"), with the data credit always shown.
- **Node markers** (Osiris anatomy: glow, outlined dot, label `garage · 0.42 m`). Markers update in place and are never rebuilt on a poll.

  | State | Marker |
  |---|---|
  | No Flood Risk | Muted dot, no glow |
  | Low / Elevated / High | Risk-colored dot and glow; the glow is strongest for High |
  | Unverified | Hollow dot, dashed grey outline, label `NOT COUNTED` |
  | Stale | Glow removed, desaturated, label `STALE · 42 s` |
  | Selected | 2 px cyan ring, larger label |

  A Node pulses once when its Flood Risk rises; never continuously. Selecting a Node highlights its Node card and the other way round. No popups.
- **Layers:**

  | Layer | Style |
  |---|---|
  | Flood-Prone Areas | Translucent blue-grey diagonal hatch (never violet, never a risk color) |
  | Shelter, open | Solid light pin with a building icon |
  | Shelter, closed | Hollow grey pin, `CLOSED` |
  | Nearest open Shelter for you | Open pin with a cyan ring, name always shown |
  | Home | Cyan house icon |
  | Route | 5 px cyan line with a dark casing |
  | Storm Signal | Slow, static darkening at the map's edges, plus the top-bar pill; no animated weather anywhere: the Weather layers change only when the Event clock's hour moves |

## Readings Panel

- Starts with a one-line Flood Risk summary; the full reasons live in the risk chip's popover.
- **Node card:** header with the Node name and its tags (`THIS NODE`, `SIMULATED`, risk, `STALE · age`, `NOT COUNTED`); water level as the hero number with a trend arrow; rain rate, pressure and soil moisture in a three-column row, each with its arrow. Arrows come from the last 30 s of polls held in the browser. No sparklines.
- **Order never changes on its own:** this Node first, then the other Registered Nodes A to Z, then Unverified Nodes under a "Not counted" divider. A card whose risk rises flashes once and stays where it is.

## Flood Risk reasons

The top-bar risk chip opens a popover with the level and every reason. Nothing floats permanently on the map. With no Flood Risk, the chip reads `NO FLOOD RISK` in muted style and the popover explains why (a calm day: not Raining, no Storm Signal, no water at 30 cm).

## Alerts Panel

- **Official card:** `OFFICIAL` or `OFFICIAL · REPLAY` tag; source (NWS · FLZ136, NHC, Alachua County); headline; issued time exactly as the source gave it; an `APPLIES TO YOUR HOUSEHOLD` chip when the plan matches; "Read at the source", which while Mesh-only reads "Source link opens when online" instead of a dead link.
- **Community card:** `COMMUNITY WARNING · NOT OFFICIAL`; a sentence built from its fields ("Water is high at garage and kitchen"); "Signed by the Hub · verified"; the fixed "Check official sources for any evacuation decision." line.
- Official cards first, newest on top, then Community cards. An acknowledged card shows a small "Acknowledged" check.

## Evacuation Plan Panel

| State | Shows |
|---|---|
| No Household Profile, desktop (the projected Hub) | Hand-off card "Your plan lives on your phone" with the Join card |
| No Household Profile, phone | Empty state and a 44 px "Set up your household" button |
| Profile, calm day | Nearest open Shelter with fit badges (special-needs, pets) and drive distance |
| Profile, storm | Your Flood Risk, then the official orders that apply to you, then Flood-Prone Area yes or no, then the Shelter card, then "Show route" |
| Warning in effect, a Reachable Shelter | The Shelter card with "N min walk, wave in M min" and its height above the river |
| Warning in effect, none reachable | "Nearest Shelter X: N min walk, wave in M min." then "No Shelter you can reach in time. Get to higher ground, away from the river, now.", no Shelter pin and no Route |
| No open Shelter | "No open Shelter announced yet. Follow official sources." and no route |
| No Route from your Grid point | Shelter labeled "straight-line distance", no line drawn |
| No Cache Pack | "Shelters and routes arrive once this Node has the Cache Pack" |

Every state ends with "Evacuation decisions come from official sources."

## Cameras Panel

A 2×2 grid of 16:9 tiles.

- **Live:** the picture, a LIVE dot and "updated 40 s ago"; a new picture cross-fades in over 300 ms.
- **Offline** (the Node is Mesh-only): dashed muted frame, camera-off icon, `OFFLINE · internet down`, no picture.
- **Unavailable** (one camera failed while Online): solid frame, alert icon, `UNAVAILABLE`. Never mistaken for Offline.

## Hub Panel

The "Hub" button in the top bar opens a slide-over with four tabs; the map keeps updating underneath.

- **Registry** (default): Node name, Node id in mono, `REGISTERED`, `UNVERIFIED` or `SIGN-UP WAITING`, last heard, and Accept for a waiting sign-up.
- **Warnings:** the Community Warning log, each with time, Nodes and reasons.
- **Shelters:** one toggle per Shelter.
- **Feeds:** Live / Replay segmented control and each feed's last fetch.

## Node Panel

Shown only when the dashboard is opened on the Node's own machine (`localhost`); the "Node" button sits beside the Hub button. On the Hub both exist.

- **Scenario:** the stepper with the current beat highlighted, and Reset. The `n` (step) and `r` (reset) keys work only here.
- **Registration:** `UNVERIFIED`, then "Sign-up sent, waiting for the Hub", then `REGISTERED`, with a "Sign up with the Hub" button.

## Join card

Two codes a phone scans: the first joins the hotspot Wi-Fi (`WIFI:` format), the second opens the dashboard URL. Generated in the browser (`qrcode-generator` 2.0.4), so it works offline. It sits in the hand-off card and is on screen during the Normal-day beat.

## Warning Takeover

Any new Official Alert or Community Warning takes over. It is the only thing allowed to overpower the layout.

- **Desktop:** an 880 px card centered over the map, which stays live underneath and is dimmed to 40%; a full-width 64 px Acknowledge button. **Phone:** a full-screen sheet.
- Official and Community keep their own treatment inside the same frame: Official on the light panel with the solid blue OFFICIAL tag; Community with the violet dashed edge, COMMUNITY WARNING · NOT OFFICIAL, and the fixed "check official sources for any evacuation decision" line.
- If both are pending, Official shows first, then Community ("1 of 2").
- Acknowledgement is per device and stored in that browser, keyed by the warning's id. A new warning opens the takeover again; the same one does not.
- After acknowledging, a banner stays under the top bar and the card stays in the Alerts Panel. A warning never silently disappears.
- One short two-note chime when the takeover opens, on any device whose page has been tapped once (browsers block sound before that). It never loops. The border pulses slowly; never a strobe. With reduced motion on, no pulse.

## Loading, empty and error states

Never blank out data we already have; mark it stale instead.

- **Connecting:** static skeleton blocks and "Connecting to garage…". No shimmer, no spinner.
- **Node unreachable:** a banner saying when the Node was last heard; the last data stays on screen, marked stale.
- **No Cache Pack yet:** the map shows readings only; the Plan says Shelters and routes are on their way.
- **Storage problem:** the Household Profile banner from `App.tsx`.
- Every empty Panel says in one line why it is empty, with its icon.

## Visual language

| Thing | Rule |
|---|---|
| Theme | Dark. Colors come in two layers: **primitives** (the raw palette, used only in the theme file) and **roles** (what a color is for, used by every component). Re-theming is editing the primitive-to-role mapping in one file. No raw hex outside the theme file, in code or on the canvas |
| Roles | `--bg-page`, `--surface-panel`, `--surface-raised`, `--surface-glass`, `--surface-solid`, `--border`, `--border-strong`, `--text-primary`, `--text-secondary`, `--text-dim`, `--accent`, `--accent-ink`, `--risk-low`, `--risk-elevated`, `--risk-high`, `--danger`, `--official-bg`, `--official-ink`, `--official-tag`, `--official-tag-ink`, `--community-warning`, `--flood-prone`, `--map-ground`, `--map-block`, `--map-road`, `--map-water`, `--scrim`, `--focus-ring`. The table, with measured contrast, is on the canvas Foundations page; the canvas links a copy of the theme file as `theme.css` |
| Contrast | At least 7:1 for all text on its background. Greyed-out Unverified Nodes are the only deliberate exception, and stay at least 4.5:1 |
| Scale | Projector-first on desktop: everything at 120% (body about 18 px, tags about 14 px). The map stays the biggest thing on screen. Phones use the base scale |
| Type | IBM Plex Sans (400, 600, 700) for text; IBM Plex Mono (500, 600) for labels, tags and numbers, with tabular figures so numbers never shift. **Bundled with the dashboard** (`@fontsource/ibm-plex-sans` and `@fontsource/ibm-plex-mono` 5.3.0), never loaded from Google Fonts: a Mesh-only Node has no internet |
| Icons | `lucide-react` 1.49.0, pinned, is the only icon source; sizes 16, 20 and 24. The canvas icon inventory names every icon and where it is used. The Storm Shield logo mark is the one custom drawing |
| Panels | Desktop: `--surface-glass`, 1 px border, 8 px backdrop blur, 8 px radius. Phone: near-opaque surface, no blur |
| Controls | One kit, every state drawn on the canvas: primary, secondary, ghost, danger and icon buttons at 32, 40 and 44 px (phones always 44); text field, map-pick field, radio, checkbox, toggle, segmented control, tabs, rail button with badge, chip. States: default, hover, pressed, focus-visible (2 px `--focus-ring`), disabled, busy. 6 px radius, labels never wrap. Nothing interactive outside the kit |
| Flood Risk | Low green, Elevated amber, High red; always with the word, never color alone |
| Official Alerts | Light panel, solid blue OFFICIAL tag, OFFICIAL · REPLAY for replays, link to the source |
| Community information | Cyan accents; Community Warnings have a violet dashed edge. Never the official style |
| Simulated Readings | Always carry a SIMULATED tag |
| Unverified Nodes | Greyed out, NOT COUNTED tag |
| Stale | After 15 s: desaturated, with STALE and the age, in muted grey (never amber, which means Elevated) |

## Motion

"Reactive" means every change in the data is visible, smooth and never jarring.

| Change | Motion |
|---|---|
| A reading changes | Its number ticks to the new value and its slot flashes for 600 ms |
| A Node's Flood Risk rises | Its chip cross-fades, its marker pulses once, its card flashes once |
| A Node appears | Marker and card fade in over 300 ms |
| A Node goes Stale | Desaturates over 300 ms; the label changes in place |
| Online to Mesh-only | Camera tiles dim and relabel in place; the pill cross-fades |
| A Panel opens | Slides 8 px and un-blurs over 180 ms |
| Colors change | Ease over 300 ms |
| A fresh Alert | Pulse ring on the Alerts rail button |
| A control is pressed | 120 ms press feedback |

With reduced motion on, every change is an instant swap with no pulse or flash. The canvas Flows page holds a transitions sheet with before, after, duration and easing for each row.

## Performance

These are acceptance lines on every dashboard ticket, not a later polish pass.

- Animate only `transform` and `opacity`.
- A poll that changes nothing re-renders nothing; markers are updated in place.
- No layout shift when numbers change: tabular figures, fixed-width value slots.
- 60 fps while panning the map with Panels open, and under 8 ms of work per poll, on a mid-range phone.
- Backdrop blur on desktop only.
- Keep the aria-labels the tests query when restyling.

## Changing the design

Expect small changes once the dashboard is in real hands.

- **Polish** (spacing, copy, timing, colors within the roles): change the code directly; sync the canvas in one batch at the end of the day.
- **Anatomy** (a new element, a moved Panel, a new state): change the canvas first, then the code.
- **Tokens:** the theme file in `dashboard/src/` owns them; the canvas mirrors it.
