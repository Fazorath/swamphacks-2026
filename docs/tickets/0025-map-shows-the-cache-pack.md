# 0025: The map shows the Cache Pack

**What to build:** The dashboard map uses the Cache Pack's dark tiles, marks the Shelters and draws the Flood-Prone Area overlay, so a phone shows them with the internet unplugged. Split out of 0007 so the Node and script side could ship without waiting for the map.

**Blocked by:** 0005, 0007

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] The tile source is one setting the map reads: the Node's own `/api/cache-pack/files/tiles/{z}/{x}/{y}.png` when the pack is available, the online tiles 0005 uses when it is not
- [ ] The data credit "© OpenStreetMap contributors © CARTO" is always shown on the map
- [ ] Each Shelter in `shelters.json` is marked on the map with its name and its special-needs and pet-friendly flags
- [ ] The Flood-Prone Area overlay is drawn from `flood_prone.geojson`, with the creek layer visibly marked approximate
- [ ] Vitest tests with a fixture pack: the map reads tiles from the pack when available and falls back when not; every Shelter in the pack gets a marker
- [ ] Manual check: with the internet off, the map, Shelters and Flood-Prone Areas render on a phone
- [ ] All **Commands** pass
