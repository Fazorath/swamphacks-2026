# Fort Myers sources for the Hurricane Ian Replay

Raw inputs for the Ian Replay of the Fort Myers Region (issue #21). All are US government data, public domain.

| File | What | From |
|---|---|---|
| `noaa-8725520-fort-myers-water-level.csv` | Fort Myers tide gauge, 6-minute verified water level, ft above MHHW, UTC, 26–30 Sep 2022. Peak 7.257 ft at 2022-09-28 22:30. | NOAA CO-OPS `datagetter`, `station=8725520&product=water_level&datum=MHHW&units=english&time_zone=gmt` |
| `nws-tbw-warnings-2022-09.csv` | Every NWS watch and warning from the Tampa Bay office (TBW), 20–30 Sep 2022. Lee County is zones FLZ165 (coastal) and FLZ265 (inland). | Iowa Environmental Mesonet watch/warning download, filtered to `wfo == TBW` |
| `usgs-stn-ian-sensors-lee-collier.csv` | Where USGS deployed storm sensors for Ian in Lee and Collier counties, with instrument ids. Positions only, no readings. | USGS STN Flood Event Viewer, event "2022 Ian", filtered to Lee and Collier counties |

Still missing: the Fort Myers predicted tide, the Naples gauge (8725110, measured and predicted), and the USGS sensor readings. Until the readings are in, Estero Bay's water is the Fort Myers curve scaled to the 12.7 ft MHHW peak NHC reports at Fort Myers Beach Pier, and the Replay says so.
