# 0007: Cache Pack: Shelters, Flood-Prone Areas and map tiles

**What to build:** While online, a Node downloads the Cache Pack. After that, the dashboard map shows neighborhood tiles, Shelters and Flood-Prone Areas even with the internet unplugged.

**Blocked by:** 0005

**Status:** ready-for-agent

**Owner:** unclaimed

**Spec:** `docs/specs/storm-shield.md`

- [ ] A build script, run ahead of the event, produces the Cache Pack: Shelters (FDEM Alachua table, special-needs and pet-friendly flags, cross-checked with FEMA open shelters), Flood-Prone Areas (FEMA NFHL plus Hogtown Creek and Sweetwater Branch floodplains) and neighborhood map tiles
- [ ] A Node downloads the full Cache Pack while online and keeps it on disk
- [ ] The Node serves the Cache Pack to Viewers; the map uses its tiles and shows Shelters and the Flood-Prone Area overlay
- [ ] Manual check: with the internet off, the map, Shelters and Flood-Prone Areas still render on a phone
- [ ] Seam A tests: a Node with a downloaded Cache Pack serves it through the API with the internet marked off
- [ ] All **Commands** pass
