# 0005: Readings on the map

**What to build:** A resident opens the dashboard and sees a Leaflet map of the neighborhood with every Node at its approximate position, showing its latest readings, how old they are and that they are simulated. No one's exact location is ever shared.

**Blocked by:** 0003

**Status:** done

**Owner:** leonardorofaDV

**Spec:** `docs/specs/readings-on-the-map.md`

- [x] Each Node has a configured location; it is fuzzed to about 200 m before anything is published
- [x] The dashboard map shows a marker per Node at its fuzzed position with its latest readings
- [x] Markers show staleness (age of the latest reading) and the simulated label
- [x] The map uses online tiles for now; offline tiles come in 0025
- [x] Seam A tests: positions another Node sees are never the exact configured location, and they stay within about 200 m of it
- [x] All **Commands** pass
