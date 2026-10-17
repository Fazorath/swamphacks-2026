# Reticulum is the mesh from the first ticket

Nodes are a Raspberry Pi 4 and teammates' laptops (no ESP32 or LoRa boards), so we use Reticulum over Wi-Fi as the mesh and build the very first slice on it, rather than starting on an MQTT star and swapping later. A hub-and-spoke broker would be faster to stand up but is not a mesh: the demo must show readings surviving a dead Node, and building twice wastes a weekend.

## Considered Options

- **MQTT star (Mosquitto on the Pi):** working in under an hour, but a single point of failure and not honestly a mesh.
- **Meshtastic:** needs LoRa radios we don't have, and can't carry soil moisture without custom firmware.
- **Hand-rolled UDP gossip:** small, but every routing and discovery bug is ours.
- **libp2p / Hypercore:** laptop-only and heavy for 36 hours.

## Consequences

- Node and Hub software is Python, because Reticulum is.
- The cut-line slice (one Node to dashboard, internet unplugged) carries Reticulum setup risk on day one; rehearse it Saturday.
- Every Node has a Reticulum identity, which is what Node registration and Community Warning signatures build on.
