# The map shows the Cache Pack

**Status:** ready-for-agent

Ticket 0025. Decisions from the grill on 2026-10-17.

## Problem Statement

A resident looking at the map sees only the Nodes and, once a plan is made, the one Shelter it chose. The other Shelters and the river corridor are in the Cache Pack on every Node's disk, but nothing draws them, so with the internet unplugged the phone cannot show where else to go or where the water is likely to reach.

## Solution

The map draws every Shelter in the Cache Pack and the Flood-Prone Area overlay from the pack's own files, so it works with no internet. Each Shelter is labelled with its name and its special-needs and pet-friendly flags; a Shelter the Hub has not announced as open is marked Closed. The overlay is always marked approximate.

## User Stories

1. As a resident, I want every Shelter in the Cache Pack marked on the map, so that I can see my options and not only the one the plan picked.
2. As a resident who needs a special-needs or pet-friendly Shelter, I want those flags in each Shelter's label, so that I can tell at a glance which ones fit me.
3. As a resident, I want a closed Shelter to say Closed on the map, so that I never head for a place that cannot take me.
4. As a resident, I want the Shelter the Evacuation Plan chose to stand out from the others, so that I know which one to go to.
5. As a resident, I want the river corridor drawn on the map, so that I can see which areas the wave may reach.
6. As a resident, I want the corridor clearly labelled hand-drawn and approximate, so that I do not read it as a survey and treat its edge as a safe line.
7. As a resident with no internet, I want the Shelters and the corridor to appear from the Node's own disk, so that the map is as useful during the outage as before it.
8. As a resident on a Node whose pack has not arrived yet, I want the map to work without them, so that Nodes and the plan still show.

## Implementation Decisions

- **Data.** `useCachePack` already loads `shelters.json` and `flood_prone.geojson`; no Node change and no new endpoint. No pack means no Shelter markers and no overlay, with no error.
- **Shelter markers.** Every pack Shelter gets a marker with a permanent tooltip in the style of the Node labels (no popups, per `docs/design/ui.md`): `Name · special needs · pets`, naming only the flags that are true. A Shelter not in `openShelterIds` carries a `Closed` word in its label and a `closed` class. Closed is judged the way the Evacuation Plan judges it: open only once the Hub has announced it, so before the first announcement every Shelter reads Closed.
- **The plan's pick.** The Shelter the Evacuation Plan chose keeps the existing `shelter-marker` look and is not drawn twice; the others use a plainer class. Final pins (solid open, hollow grey closed, cyan ring) are ticket 0035.
- **Overlay.** `floodProne` features are drawn as Leaflet GeoJSON (GeoJSON order is `[lon, lat]`, which Leaflet's GeoJSON layer handles) with a dashed outline and a light fill, not interactive (taps pass through to the map, so Home picking and Road blocking work over them), under the Nodes. A fixed caption "Flood-Prone Area: hand-drawn, approximate" shows on the map while the overlay is drawn. The hatch is 0035.
- **Deep module.** One small `PackLayers` component (Shelters and overlay) inside `NodeMap.tsx`'s folder; `NodeMap` receives `shelters`, `openShelterIds` and `floodProne` as props from `App`. The chosen-Shelter prop stays as it is.
- **Glossary.** `CONTEXT.md` Flood-Prone Area: add that the map always marks it approximate. No new term, no ADR.
- **Tile credit.** Already shown by the tile layer (0026).

## Testing Decisions

- **Seam.** Seam B, the dashboard flow tests with a stubbed `fetch` (the existing `evacuationFlow.test.tsx` style). No new seam. A good test asserts what the resident sees (markers, labels, caption), not Leaflet internals.
- **Behaviors covered:**
  - with a fixture pack of several Shelters, every Shelter gets a marker with its name;
  - the special-needs and pet-friendly flags appear in the label only when true;
  - a Shelter the Hub has not announced reads Closed; one announced open does not;
  - the plan's chosen Shelter is marked once, apart from the others;
  - with a pack, the overlay path and the approximate caption are present; with no pack, neither is;
- **Jsdom limits.** Leaflet draws no tiles at zero size (lessons: Home Profile, Map tiles), so markers are found by their class and tooltip text, and the overlay by its path class. Map assertions wait with `waitFor`.
- **Break check.** Remove the render of the other Shelters and confirm the new tests fail.
- **Manual check.** Rehearsed on one laptop: a Node with the valley pack, the pack server stopped, a phone over Tailscale showing the Shelters and the overlay. Not a Pi check.

## Out of Scope

- Final marker and overlay styling (hatch, pins, cyan ring): ticket 0035.
- Layer show/hide buttons: ticket 0034.
- Pack tiles and the tile credit: ticket 0026.
- Checking the real corridor against a survey; it stays hand-drawn.

## Further Notes

- The ticket text mentions FEMA zones from the Gainesville pack; the demo pack is the valley pack (ADR 0004) and its corridor is one hand-drawn polygon set tagged `APPROXIMATE` in its `source` property.
