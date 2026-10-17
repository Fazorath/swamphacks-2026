# The Hub is a Node on the mesh, not a cloud server

One central Hub collects every Community Reading, decides when to send signed Community Warnings and hosts the central dashboard. We run it on a mesh Node (also the one that pulls official feeds and the Cache Pack while online) instead of in the cloud, because the hero moment is the internet going down: a cloud server would vanish exactly then, and warnings would stop.

## Considered Options

- **Cloud server:** reachable from anywhere, but dark whenever the internet is.
- **Mesh Node plus cloud mirror:** possible later stretch; adds nothing to the 3-minute demo.

## Consequences

- The Hub is a single point of failure for Community Warnings only. Every Node computes its own Flood Risk, so residents still see risk rising if the Hub drops out.
- A warning needs High Flood Risk on two or more Registered Nodes, and only Registered Nodes count, so one bad or fake sensor can't trigger one.
- Community Warnings never order an evacuation; they point residents to official sources.
