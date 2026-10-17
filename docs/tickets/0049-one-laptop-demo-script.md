# 0049: One command starts the whole demo

**What to build:** On the demo laptop one script starts the Cache Pack server, the Hub at Betrawati and Sensors S0–S3 on loopback, each with its own port, slot, data folder, position, River km and track, and prints the dashboard address for the projector and the phones. Stopping it stops everything.

**Blocked by:** 0043, 0044

**Status:** done

**Owner:** Fazorath

**Spec:** `docs/specs/flash-flood-replay.md`

- [x] One script starts the five Nodes and the pack server, waits for the Hub's identity and hands it to the Sensors as `HUB_IDENTITY`
- [ ] It registers S0–S3 with the Hub so every Node counts, once 0012 lands
- [x] It prints the laptop's local and Tailscale addresses
- [x] Setup notes for the laptop hotspot, the projector and the two phones' Household Profiles (Syabrubesi and Betrawati) sit next to the script
- [x] The README's "Run the demo" section points to it
- [ ] Manual check: the full replay runs on one laptop with two phones joined; record what was rehearsed and what stays unproven on real devices
- [ ] All **Commands** pass

**Merged untested on phones (2026-10-17).** The team is working remotely, with no second phone and no demo setup, so the manual check was not done. Merged anyway on purpose. What was rehearsed: on one laptop over loopback (ports 8600 to 8604), the script refused a busy port, started all five Nodes, the Sensors took the pack and the Hub's Shelters, and SIGTERM stopped everything. Still untested before the demo:
- The full replay from Start to the end, with two phones joined (Syabrubesi and Betrawati Household Profiles).
- The hotspot setup in `scripts/demo-setup.md` on the demo laptop, and "cut the internet" with the upstream switched off.
- Registering S0 to S3 with the Hub (waits on 0012).
- Anything on a Pi or over Wi-Fi.
- Commands: the Python and dashboard Commands passed on the first build of this branch; the fix-up commit changed only the shell script and docs.
