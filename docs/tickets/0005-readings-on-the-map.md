# 0005: Readings on the map

**What to build:** A resident opens the dashboard and sees a Leaflet map of the neighborhood with every Node at its approximate position, showing its latest readings, how old they are and that they are simulated. No one's exact location is ever shared.

**Blocked by:** 0003

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] Each Node has a configured location; it is fuzzed to about 200 m before anything is published
- [ ] The dashboard map shows a marker per Node at its fuzzed position with its latest readings
- [ ] Markers show staleness (age of the latest reading) and the simulated label
- [ ] The map uses online tiles for now; offline tiles come in 0007
- [ ] Seam A tests: positions another Node sees are never the exact configured location, and they stay within about 200 m of it
- [ ] All **Commands** pass
