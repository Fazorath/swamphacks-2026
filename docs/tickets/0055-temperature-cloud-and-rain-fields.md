# 0055: Temperature, cloud cover and rain fields

**What to build:** Picking Temperature, Cloud cover or Rain draws a smooth colour field over the map from the Weather Grid, with a legend and units, locked to the Event clock while a Replay runs. A Viewer can read the weather over the valley as the flood unfolds.

**Blocked by:** 0052, 0054, 0044

**Status:** ready-for-agent

**Owner:** unclaimed

**Assignee:** Fazorath

**Spec:** `docs/specs/weather-layers.md`

- [ ] One low-resolution canvas under the Nodes, Route and Shelters, interpolated and smoothed; panning and zooming keep it aligned
- [ ] Temperature: diverging scale in °C. Cloud cover: white to grey, %. Rain: transparent to deep blue, mm/h; none of them uses a risk colour
- [ ] Legend with units, the tag `RECORDED WEATHER · 26 Aug 2026`, the note that the grid is coarse, and the Open-Meteo credit
- [ ] The field follows the Event clock; with no clock it shows the first hour of the file
- [ ] If the replay file is missing the layer shows a clear "weather not downloaded" state, not a blank map
- [ ] No copy or legend links rain to the avalanche
- [ ] Vitest: the canvas redraws when the Event clock moves an hour; legend, tag and credit render for each layer; the missing-file state renders
- [ ] 60 fps panning with a layer on and Panels open on a mid-range phone, checked by hand and noted in the ticket
- [ ] All **Commands** pass
