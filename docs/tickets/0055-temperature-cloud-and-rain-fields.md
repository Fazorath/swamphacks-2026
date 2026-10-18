# 0055: Temperature, cloud cover and rain on the terrain

**What to build:** Picking Temperature, Cloud cover or Rain lays that layer over the whole of Nepal, draped on the map's terrain, with a legend and units, locked to the Event clock while a Replay runs. A Viewer sees the sky over the country as the flood unfolds, and in 3D the rain sits between the mountains.

**Blocked by:** 0054, 0073

**Status:** in-progress

**Owner:** Fazorath

**Assignee:** Fazorath

**Spec:** `docs/specs/weather-layers.md`

**Prototype:** branch `prototype/weather-layers`, `dashboard/prototype-weather-layers.html` (`?variant=B` for Temperature and Rain, `?variant=D` for Cloud cover). Throwaway code: rewrite, don't copy.

- [ ] A `weatherField` module paints one layer for one moment into a small image in latitude/longitude over the Weather Grid's box; the map shows it as one MapLibre `image` source draped on the terrain, under Nodes, Route, Shelters and place labels. No canvas over the map
- [ ] Temperature: smooth diverging ramp, °C. Rain: smooth transparent-to-deep-blue, mm/h, zero fully transparent. Neither uses a risk colour, and the scales are fixed (not stretched to the data)
- [ ] Cloud cover: white cloud from a fixed noise texture, the cover value deciding how much shows (overcast at 100%, wisps at 30%); the noise is fixed in lat/lon so clouds grow and thin with the hour but do not crawl
- [ ] Legend with units, the tag `RECORDED WEATHER · 26 Aug 2026`, the note that the grid is coarse, and the Open-Meteo credit
- [ ] The layer follows the Event clock, repainting at most once a second; with no clock it shows the file's first hour
- [ ] If the replay file is missing the layer shows a clear "weather not downloaded" state, not a blank map
- [ ] No copy or legend links rain to the avalanche
- [ ] Vitest: the image changes when the Event clock moves an hour; zero rain is a transparent pixel; full cloud is more opaque than 30% cloud; legend, tag and credit render for each layer; the missing-file state renders
- [ ] 60 fps panning in 2D and 3D (0067) with each layer on and Panels open, on the demo laptop and a phone, checked by hand and noted in the ticket; if 0067 is not merged yet, say so and check 2D only
- [ ] All **Commands** pass
