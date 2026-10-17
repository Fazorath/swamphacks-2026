# Node

The Node service: FastAPI, the Scenario, and the Mesh that shares Community Readings with other Nodes. See `AGENTS.md` for install, test and lint commands.

## How the Mesh works

`storm_shield/reticulum_mesh.py` is the only code that knows about Reticulum.

- Each Node has a Reticulum identity in `NODE_DATA_DIR` (default `node/data/`, gitignored). Its **Node id** is the first 12 hex characters of that identity, printed at startup and returned by `GET /api/node`.
- A Node announces itself on start and every 10 s. Other Nodes keep its public key from the announce.
- Readings go out as one unencrypted broadcast packet: a 64-byte signature, then the JSON. Reticulum does not say who sent a data packet, so a receiver checks the signature against the announced key and drops anything from a Node it has not heard announce yet.
- The Reticulum config is regenerated from the settings on every start.

## Running Nodes

Wi-Fi (the demo; Pis and laptops on one network, no addresses to configure):

```
cd node
uv run storm-shield-node
```

Allow UDP ports 29716 and 42671 through each laptop's firewall (on Windows, set the Wi-Fi network profile to Private). Give each Node on the network its own `NODE_NAME`.

Several Nodes on one machine, without the Pis (`NODE_MESH_INTERFACE=loopback`). Give each its own `NODE_LOOPBACK_SLOT`, `NODE_PORT` and `NODE_DATA_DIR`:

```
# PowerShell, one terminal per Node
$env:NODE_MESH_INTERFACE="loopback"; $env:NODE_LOOPBACK_SLOT="0"; $env:NODE_PORT="8000"; $env:NODE_DATA_DIR="data/a"; uv run storm-shield-node
$env:NODE_MESH_INTERFACE="loopback"; $env:NODE_LOOPBACK_SLOT="1"; $env:NODE_PORT="8001"; $env:NODE_DATA_DIR="data/b"; uv run storm-shield-node
```

Two Nodes on one machine cannot use `auto`: AutoInterface ignores the machine's own addresses and its UDP ports collide.

Moving to the Pis: on each Pi leave `NODE_MESH_INTERFACE` unset (it defaults to `auto`) and give it its own `NODE_NAME`. Nothing else changes.

`NODE_MESH=memory` starts a Node that hears only itself.

## Tests

`tests/test_reticulum_mesh.py` checks signing and verification. `tests/test_reticulum_nodes.py` starts three real Node processes on the loopback interface (HTTP ports 8101-8103, Reticulum ports 4250-4252) and takes about 15 s; stop any Node running on those ports first.
