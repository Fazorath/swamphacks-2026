# Camera Clips

Three five-minute demo camera clips, built by `scripts/make_camera_clips.py` from the sources in `scripts/camera-clips/sources.json`. The Hub's Cameras Panel plays one per site, lined up with the Event clock (tickets 0075 and 0077). `manifest.json` gives each clip's length, its credits and `flood_onset_s`, the second the water visibly jumps.

**All three are illustrative.** They are joined from other people's footage, some of it slowed down or played forward then backward to fill the time, and none of it was filmed at the Node's site. The Cameras Panel is to label them as a replay (ticket 0075).

| Clip | Shows | `flood_onset_s` |
|---|---|---|
| `clip-1-calm-then-surge` | calm river for about 170 s, then a muddy rise and a flooded creek, partly in slow motion (the story clip) | 193.0 |
| `clip-2-extreme-debris-over-road` | calm river, a creek rising in slow motion, then a debris flow over a road and wall, then debris passing a bridge and a flooded path | 157.6 (`rise_onset_s` 103.6) |
| `clip-3-rise-below-flooding` | calm river, a creek that rises and falls back within its banks, calm again | none (`rise_onset_s` 137.8) |

## Credits

Every source below is public domain or CC0; each licence was read from the wikitext of its Wikimedia Commons file page on 2026-10-18. The BLM and NPS files carry a public-domain tag (US federal work) and Flickr's CC BY tag; both allow what we do, and the credit lines below satisfy CC BY.

| Source | Used for | Credit and licence |
|---|---|---|
| [Wallowa River](https://commons.wikimedia.org/wiki/File:Wallowa_River_(35166286545).webm), 9 s | the calm river, slowed to half speed and played forward then backward | BLM Oregon & Washington, 7 June 2017. Public domain (PD-USGov-BLM), also CC BY 2.0 |
| [Debris flow in Bondo](https://commons.wikimedia.org/wiki/File:Bondo_Aug_2017.webm), 83 s | **real footage**: the Bondo debris flow, Switzerland, 23 August 2017, over a road and wall | Swiss Force One. CC0 |
| [Debris Flows Through Bright Angel Creek](https://commons.wikimedia.org/wiki/File:Debris_Flows_Through_Bright_Angel_Creek_(55504603393).webm), 43 s | **real footage**: Bright Angel Creek, Grand Canyon, flash flood of 29 August to 2 September 2026, the creek rising and debris passing a bridge, also slowed down | NPS / K. Hensel, Grand Canyon NPS. Public domain (PD-USGov-NPS), also CC BY 4.0 |
| [Bright Angel Flash Flood](https://commons.wikimedia.org/wiki/File:Bright_Angel_Flash_Flood_(55504573056).webm), 23 s | **real footage**: the same flood, rain and water over a path, slowed down | NPS / K. Hensel, Grand Canyon NPS. Public domain (PD-USGov-NPS), also CC BY 4.0 |

`manifest.json` lists, per clip, which seconds of the output are real footage of which event (`pieces[].real_footage_of`) and which source range each piece uses. The calm river is the only piece that is not a flood; everything after the onset is real footage of a flood, none of it from Nepal. A Catalan flash-flood clip (Riera de Cabrils) was dropped: its Commons page says both PD-self and CC BY-SA 4.0, and share-alike would bind the joined clips.

## The stage set (never committed)

`python3 scripts/make_camera_clips.py --local` (see the top of the script for the `ffmpeg` options) builds **every** clip, committed ones included, into `.demo/clips/`, which is gitignored. It adds `clip-4-real-gyirong-then-surge`, which uses CCTV footage of the 26 August 2026 flood at Gyirong Port on the Tibet side of the border, from Wikimedia Commons (`Mudslide_at_Gyirong_Port_1` and `_2`). Commons tags it `Pd-automated` (no human author) and credits a news organisation's X post as the source, which we cannot verify. It stays out of the repository, as the spec requires for footage we do not hold the rights to, and is built on the demo laptop only; the group may still decide against showing it. `scripts/run-demo.sh` uses `.demo/clips/` when it holds a `manifest.json`, and this folder otherwise, and prints which.

Any other news footage we do not hold the rights to goes the same way: add it to `sources.json` with `"distribution": "local"` and a credit line, and build with `--local`. The script refuses a committed clip that uses a local source.

## Rebuilding

```
uv run --with imageio-ffmpeg python scripts/make_camera_clips.py          # this folder
uv run --with imageio-ffmpeg python scripts/make_camera_clips.py --local  # .demo/clips/
python3 scripts/make_camera_clips.py --plan                               # timelines only
```

Sources download once into `.demo/clip-sources/` (Wikimedia answers HTTP 429 to bursts, so the script waits and retries). The committed clips are 854 × 480 H.264 (Main profile, 24 fps, no audio) at about 160 kbit/s, 17.9 MB in all.
