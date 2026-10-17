# 0025: The map shows the Cache Pack

**What to build:** The dashboard map marks the Shelters and draws the Flood-Prone Area overlay from the Cache Pack, so a phone shows them with the internet unplugged. Split out of 0007 so the Node and script side could ship without waiting for the map. The Cache Pack tiles and the data credit moved to 0026.

**Blocked by:** 0005, 0007, 0026

**Status:** done

**Owner:** leonardorofaDV

**Spec:** `docs/specs/storm-shield.md`

- [x] Each Shelter in `shelters.json` is marked on the map with its name and its special-needs and pet-friendly flags
- [x] The Flood-Prone Area overlay (the hand-drawn river corridor) is drawn from `flood_prone.geojson`, visibly marked approximate
- [x] Vitest tests with a fixture pack: every Shelter in the pack gets a marker
- [ ] Manual check: with the internet off, the Shelters and Flood-Prone Areas render on a phone
- [x] All **Commands** pass

## Notes

- The manual check (phone, internet off) has not been run; the Vitest flow tests stand in for it. Needs the valley pack served by a Hub on loopback and a phone over Tailscale.
