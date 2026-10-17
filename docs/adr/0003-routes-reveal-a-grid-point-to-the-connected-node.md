# Routes reveal the home's Grid point to the connected Node

The Cache Pack holds one Route file per Grid point, so a Viewer must ask its connected Node for the file of the Grid point nearest home. That tells that one Node the home to about 100 m; the Household Profile still never travels over the Mesh. We accepted this because the Fuzzed Position of a Sensor Node is already 200 m on the same reasoning, and the alternatives cost more than the threat is worth.

## Considered Options

- **Request decoy Grid points too:** hides the home among others, at the price of extra bandwidth and code for a threat nobody has named.
- **Download every Route file once:** keeps the home fully private but is far too large for a phone.

## Consequences

- The 0008 test "no request carries the profile" must allow the Route file request and assert nothing else carries it.
