# The God's Eye View is a MapLibre vector map, and the simulated fleet is display data

The dashboard's map was a Leaflet raster map: tiles fetched live from CARTO through the Node, which stutter and look like a stock web map. The central idea of the project is a Nepal-only "God's Eye View" in the style of Osiris: a dark, instant, labelled map of the whole country with a network of Nodes glowing on it and the flood wave visibly running down the river. This ADR records the three decisions that make it possible (decided 2026-10-18).

1. **The map is MapLibre GL drawn from vector data in the Cache Pack**, not raster tiles. Borders, districts, rivers and places are small GeoJSON-style layers styled by our own theme roles; nothing is fetched at run time, so it loads at once and works Mesh-only. Elevation tiles in the pack give a slight 3D terrain (a pitched, exaggerated valley), with a 2D / 3D switch and an automatic fall back to 2D if frame rate drops. Leaflet leaves the map.
2. **Superseded by [ADR 0006](0006-a-general-sensor-network-with-flood-warning-first.md); the Simulated Fleet was deleted (issue #29).** About 40 simulated Nodes (the Simulated Fleet) are display data, not Nodes.** The Hub reads a fleet file from the Cache Pack and serves it in the state snapshot. Fleet entries never join the Mesh, never count toward Flood Risk or a Community Warning, and cannot be Registered (the registry fits about 8 Nodes in one signed packet). Their tracks are derived from real Open-Meteo weather data. One quiet badge ("Simulated network · weather from Open-Meteo") is always visible; the real Nodes carry a `REAL` ring. The pitch says plainly which Nodes are real.
3. **Osiris is inspiration, not a scaffold.** It is MIT licensed (MapLibre GL, Next.js, a 3,453-line map component that loads CARTO's online style), so we port only its small terrain helpers under their licence notice and rebuild the look in our own theme.

## Considered Options

- **Keep Leaflet with a bigger raster Nepal pack:** least change, but it keeps the stutter and the stock-web-map look.
- **Vector tiles (PMTiles) in the pack:** richest, but a larger build and a bigger swap for a map of one country.
- **Run the fleet as real Node processes:** impossible at 40 on one laptop, and the registry could not hold them.
- **Present the fleet as real Nodes:** rejected. The repo's rule is that Simulated Readings are always labelled; a false claim to judges would also undermine the Nodes that really are live.

## Consequences

- Tickets 0033 and 0035 are rewritten on MapLibre; the phone layout (0036) waits on testing with real phones.
- `ui.md` loses the "no globe" line's Leaflet assumptions: the map layout, markers and the Cache Pack tile rules change (see `docs/specs/gods-eye-view.md`).
- A `cache-pack-v4` carries the Nepal vector bundle, elevation and the fleet file. The raster tiles and the CARTO proxy leave the map's path.
- Borders are drawn as the open dataset gives them, with the line "Boundaries are indicative". We make no political claim.
- Audience Nodes (a prepared laptop handed to a volunteer) are real Nodes and show a contact-lost cue when they drop.

## Addendum (2026-10-18, 0064 grill)

- **Every Node that holds the pack serves the fleet, not only the Hub**, from its own copy and its own Event clock, so a Viewer on any Node sees the same map. Nothing about the fleet crosses the Mesh.
- **Each fleet site's weather is fetched for its own position** at build time; the valley Weather Grid is not reused for sites outside the valley. Water levels are modelled from that rainfall and labelled so.
