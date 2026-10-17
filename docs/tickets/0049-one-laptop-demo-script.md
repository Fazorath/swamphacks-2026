# 0049: One command starts the whole demo

**What to build:** On the demo laptop one script starts the Cache Pack server, the Hub at Betrawati and Sensors S0–S3 on loopback, each with its own port, slot, data folder, position, River km and track, and prints the dashboard address for the projector and the phones. Stopping it stops everything.

**Blocked by:** 0043, 0044

**Status:** in-progress

**Owner:** Fazorath

**Spec:** `docs/specs/flash-flood-replay.md`

- [ ] One script starts the five Nodes and the pack server, waits for the Hub's identity and hands it to the Sensors as `HUB_IDENTITY`
- [ ] It registers S0–S3 with the Hub so every Node counts, once 0012 lands
- [ ] It prints the laptop's local and Tailscale addresses
- [ ] Setup notes for the laptop hotspot, the projector and the two phones' Household Profiles (Syabrubesi and Betrawati) sit next to the script
- [ ] The README's "Run the demo" section points to it
- [ ] Manual check: the full replay runs on one laptop with two phones joined; record what was rehearsed and what stays unproven on real devices
- [ ] All **Commands** pass
