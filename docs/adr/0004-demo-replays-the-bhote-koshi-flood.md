# The demo replays the Bhote Koshi flood of 26 August 2026

The demo was set in Gainesville / Alachua County, where floods rise slowly and the story was "the Mesh keeps working when the internet dies". We moved it to a replay of the 26 August 2026 flood on the Lhende Khola, Bhote Koshi and Trishuli in Nepal, reconstructed from reported times. A surge seen at the top of a valley travels down it at a speed that can be estimated, so a few amateur Nodes along the river could have warned the towns below well before the first official SMS (about 43 minutes instead of 5 at Betrawati). That is a stronger case for community sensing than anything Gainesville offers. We picked it over the smaller 8 July 2025 Purepu flood on the same river because it is recent and because an official SMS existed to compare against.

## Considered Options

- **Keep Gainesville:** no flash floods or storm surge to show; the warning would have nothing to beat.
- **Replay the July 2025 flood:** better documented, smaller, and there was no official alert to compare with.
- **Support both regions behind a setting:** speculative; doubles the data to keep correct.

## Consequences

- One region only. Gainesville leaves the defaults, the Cache Pack build and the docs; tests that do not depend on location keep their coordinates.
- A Replay on a Hub-driven event clock replaces the Scenario as the demo's driver.
- A Community Warning now fires on one Registered Node's Surge, and each Viewer works out the wave's ETA from River km.
- The NWS, NHC and FL511 integrations are dropped; Official Alerts and the camera become replays.
- The demo deals with a recent disaster with a large and still uncertain death toll; the tone rules in `docs/specs/flash-flood-replay.md` apply to the pitch and every screen.
