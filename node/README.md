# Node

The Node service: FastAPI, the Scenario, and the Mesh that shares Community Readings with other Nodes. See `AGENTS.md` for install, test and lint commands.

## How the Mesh works

`storm_shield/reticulum_mesh.py` is the only code that knows about Reticulum.

- Each Node has a Reticulum identity in `NODE_DATA_DIR` (default `node/data/`, gitignored). Its **Node id** is the first 12 hex characters of that identity, printed at startup and returned as `id` by `GET /api/state`.
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

Machines on different networks, or Wi-Fi discovery not working yet (`NODE_MESH_INTERFACE=tcp`, for example over Tailscale). **Every machine must have Tailscale installed and be signed in to the same tailnet**; `tailscale ip -4` prints a machine's 100.x address. Each Node lists every other Node, because Reticulum does not relay between clients:

```
# on machine A (100.64.0.1), with machines B and C at 100.64.0.2 and 100.64.0.3
$env:NODE_MESH_INTERFACE="tcp"; $env:NODE_TCP_PEERS="100.64.0.2,100.64.0.3"; uv run storm-shield-node
```

Peers are `host` or `host:port` (default port `NODE_TCP_PORT`, 4242); allow that TCP port through the firewall. Nothing is discovered in this mode, so adding a machine means editing the others' `NODE_TCP_PEERS` and restarting them. It is also the fixed-address fallback the ticket asks for if automatic discovery fails on the Pi hotspot.

On Linux (the Pis) or in Git Bash, set the same variables inline instead:

```
NODE_MESH_INTERFACE=tcp NODE_TCP_PEERS=100.64.0.2,100.64.0.3 uv run storm-shield-node
```

Two Nodes on one machine cannot use `auto`: AutoInterface ignores the machine's own addresses and its UDP ports collide.

Moving to the Pis: on each Pi leave `NODE_MESH_INTERFACE` unset (it defaults to `auto`) and give it its own `NODE_NAME`. Nothing else changes.

`NODE_MESH=memory` starts a Node that hears only itself.

## Tests

`tests/test_reticulum_mesh.py` checks signing and verification and `tests/test_reticulum_config.py` the generated Reticulum config. `tests/test_reticulum_nodes.py` starts three real Node processes, once on the loopback interface and once on fixed TCP addresses (HTTP ports 8101-8103, Reticulum ports 4250-4252 and 4350-4352) and takes under 20 s; stop any Node running on those ports first.
