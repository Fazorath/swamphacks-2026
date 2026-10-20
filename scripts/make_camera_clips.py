#!/usr/bin/env python3
"""Builds the demo's five-minute Camera Clips from short, credited source clips.

    uv run --with imageio-ffmpeg python scripts/make_camera_clips.py          # committed fallback
    uv run --with imageio-ffmpeg python scripts/make_camera_clips.py --local  # all, to .demo/clips/
    python3 scripts/make_camera_clips.py --plan                               # timelines only

Reads scripts/camera-clips/sources.json, downloads each source once into .demo/clip-sources/,
trims, slows, joins with cross-fades and writes 854 x 480 H.264 MP4s with no audio, a poster
frame for each, and manifest.json. Needs ffmpeg (a copy on PATH, $FFMPEG, or the static build
that `--with imageio-ffmpeg` provides). Stdlib only.
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
SOURCE_LIST = ROOT / "scripts" / "camera-clips" / "sources.json"
COMMITTED_DIR = ROOT / "camera-clips"
LOCAL_DIR = ROOT / ".demo" / "clips"
SOURCE_CACHE = ROOT / ".demo" / "clip-sources"

CLIP_SECONDS = 300
WIDTH, HEIGHT, FPS = 854, 480, 24
CROSS_FADE_SECONDS = 1.0
POSTER_AT_SECONDS = 3
# 170 kbps over 300 s is 6.4 MB a clip, so three committed clips stay under the 20 MB budget.
VIDEO_MAX_KBPS = 160
USER_AGENT = "storm-shield-hackathon/1.0 (https://github.com/StormShields/Stormshield)"
# No share-alike or non-commercial terms: the clips are re-encoded and joined, then committed.
COMMITTED_LICENCE = re.compile(r"Public domain|CC0|CC BY \d\.\d")
ILLUSTRATIVE_NOTE = (
    "Illustrative footage composed from the credited sources. It was not filmed at the site of "
    "the Node it plays for."
)
ROLES = ("calm", "rising", "flood", "extreme")
INSTALL_HELP = """ffmpeg was not found. Install it with one of:
  sudo apt install ffmpeg            (Debian, Ubuntu, WSL)
  brew install ffmpeg                (macOS)
  winget install ffmpeg              (Windows)
or run this script as `uv run --with imageio-ffmpeg python scripts/make_camera_clips.py`,
which fetches a static ffmpeg without touching the system."""


Record = dict[str, Any]  # a JSON object from sources.json: a source, a clip or a clip's piece


class SourceListError(Exception):
    pass


def find_ffmpeg() -> str:
    for candidate in (os.environ.get("FFMPEG"), shutil.which("ffmpeg")):
        if candidate:
            return candidate
    try:
        import imageio_ffmpeg
    except ImportError:
        raise SystemExit(INSTALL_HELP) from None
    return str(imageio_ffmpeg.get_ffmpeg_exe())


def validate(sources: dict[str, Record], clips: list[Record]) -> None:
    for source_id, source in sources.items():
        for field in ("url", "page", "licence", "credit", "distribution"):
            if not str(source.get(field, "")).strip():
                raise SourceListError(f"source {source_id}: no {field}; refusing to use it")
        if source["distribution"] not in ("committed", "local"):
            raise SourceListError(f"source {source_id}: distribution must be committed or local")
        if source["distribution"] == "committed" and not COMMITTED_LICENCE.fullmatch(
            source["licence"]
        ):
            raise SourceListError(
                f"source {source_id}: licence {source['licence']!r} cannot be committed; "
                "mark it local"
            )
    for clip in clips:
        for piece in clip["pieces"]:
            if piece["source"] not in sources:
                raise SourceListError(f"clip {clip['id']}: unknown source {piece['source']}")
            if piece["role"] not in ROLES:
                raise SourceListError(f"clip {clip['id']}: unknown role {piece['role']}")
            if clip["distribution"] == "committed" and (
                sources[piece["source"]]["distribution"] != "committed"
            ):
                raise SourceListError(
                    f"clip {clip['id']} is committed but uses local source {piece['source']}"
                )


def expand(pieces: list[Record]) -> list[Record]:
    return [piece for piece in pieces for _ in range(piece.get("repeat", 1))]


def piece_seconds(piece: Record) -> float:
    played: float = (piece["end"] - piece["start"]) / piece.get("speed", 1)
    return played * (2 if piece.get("pingpong") else 1)


def timeline(pieces: list[Record]) -> list[Record]:
    """Where each piece is fully visible in the output; a cross-fade eats the first second."""
    rows = []
    cursor = 0.0
    for index, piece in enumerate(pieces):
        seconds = piece_seconds(piece)
        if index == 0:
            visible_from = 0.0
            cursor = seconds
        else:
            visible_from = cursor
            cursor += seconds - CROSS_FADE_SECONDS
        rows.append({**piece, "starts_s": round(visible_from, 1), "seconds": round(seconds, 1)})
    return rows


def total_seconds(pieces: list[Record]) -> float:
    return sum(piece_seconds(piece) for piece in pieces) - CROSS_FADE_SECONDS * (len(pieces) - 1)


def onset(rows: list[Record], roles: tuple[str, ...]) -> float | None:
    for row in rows:
        if row["role"] in roles:
            return float(round(row["starts_s"] + row.get("onset_in_piece_s", 0), 1))
    return None


def download(source_id: str, source: Record) -> Path:
    target = SOURCE_CACHE / f"{source_id}{Path(source['url'].split('?')[0]).suffix}"
    if target.exists() and target.stat().st_size > 0:
        return target
    SOURCE_CACHE.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(source["url"], headers={"User-Agent": USER_AGENT})
    for attempt in range(1, 7):
        try:
            with urllib.request.urlopen(request, timeout=600) as response:
                partial = target.with_suffix(target.suffix + ".part")
                partial.write_bytes(response.read())
                partial.rename(target)
            time.sleep(3)  # Wikimedia throttles bursts with HTTP 429
            return target
        except urllib.error.HTTPError as error:
            if error.code != 429 or attempt == 6:
                raise SourceListError(f"{source_id}: download failed, HTTP {error.code}") from error
            wait = int(error.headers.get("Retry-After", 0)) or 60 * attempt
            print(f"  {source_id}: rate limited, waiting {wait} s", flush=True)
            time.sleep(wait)
    raise AssertionError("unreachable")


def probe_seconds(ffmpeg: str, path: Path) -> float:
    log = subprocess.run([ffmpeg, "-hide_banner", "-i", str(path)], capture_output=True, text=True)
    match = re.search(r"Duration: (\d+):(\d+):([\d.]+)", log.stderr)
    if not match:
        raise SourceListError(f"{path.name}: ffmpeg could not read its length")
    hours, minutes, seconds = match.groups()
    return int(hours) * 3600 + int(minutes) * 60 + float(seconds)


def prepare_filter(piece: Record, source: Record) -> str:
    """One piece, slowed, fitted to the frame and (if asked) played forward then backward."""
    steps = []
    if piece.get("speed", 1) != 1:
        steps.append(f"setpts=PTS/{piece['speed']}")
    steps.append(f"fps={FPS}")
    cover = f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=increase,crop={WIDTH}:{HEIGHT}"
    head = "[0:v]" + ",".join(steps)
    if source.get("fit") == "pad":
        # Portrait phone footage: the whole frame, centred over a blurred copy of itself.
        fitted = (
            f"{head},split=2[bg][fg];[bg]{cover},boxblur=24[b];[fg]scale=-2:{HEIGHT}[f];"
            "[b][f]overlay=(W-w)/2:0,setsar=1,format=yuv420p[fit]"
        )
    else:
        fitted = f"{head},{cover},setsar=1,format=yuv420p[fit]"
    if piece.get("pingpong"):
        return (
            f"{fitted};[fit]split=2[forward][back];[back]reverse[reversed];"
            f"[forward][reversed]concat=n=2:v=1:a=0[out]"
        )
    return f"{fitted};[fit]null[out]"


def prepare(ffmpeg: str, piece: Record, source: Record, source_path: Path, work_dir: Path) -> Path:
    """Renders a piece once, near-lossless, so reversing never happens inside the join."""
    fields = ("source", "start", "end", "speed", "pingpong")
    name = "-".join(str(piece.get(field, "")) for field in fields).replace(".", "_")
    target = work_dir / f"{name}.mp4"
    if not target.exists():
        subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error", "-ss", str(piece["start"]),
             "-t", str(piece["end"] - piece["start"]), "-i", str(source_path),
             "-filter_complex", prepare_filter(piece, source), "-map", "[out]", "-an",
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "14", "-pix_fmt", "yuv420p",
             str(target)],
            check=True,
        )
    return target


def join_graph(pieces: list[Record]) -> tuple[str, str]:
    # fps re-stamps every input with the same timebase, which xfade insists on.
    parts = [f"[{i}:v]fps={FPS}[p{i}]" for i in range(len(pieces))]
    cursor = piece_seconds(pieces[0])
    joined = "p0"
    for index in range(1, len(pieces)):
        parts.append(
            f"[{joined}][p{index}]xfade=transition=fade:duration={CROSS_FADE_SECONDS}"
            f":offset={cursor - CROSS_FADE_SECONDS:.3f}[x{index}]"
        )
        joined = f"x{index}"
        cursor += piece_seconds(pieces[index]) - CROSS_FADE_SECONDS
    return ";".join(parts), joined


def render(
    ffmpeg: str, clip: Record, sources: dict[str, Record], paths: dict[str, Path], out_dir: Path
) -> dict[str, Path]:
    pieces = expand(clip["pieces"])
    work_dir = SOURCE_CACHE / "prepared"
    work_dir.mkdir(parents=True, exist_ok=True)
    prepared = [
        prepare(ffmpeg, piece, sources[piece["source"]], paths[piece["source"]], work_dir)
        for piece in pieces
    ]
    graph, last = join_graph(pieces)
    command = [ffmpeg, "-y", "-loglevel", "error"]
    for path in prepared:
        command += ["-i", str(path)]
    video = out_dir / f"{clip['id']}.mp4"
    command += [
        "-filter_complex", graph, "-map", f"[{last}]", "-t", str(CLIP_SECONDS), "-an",
        "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-maxrate", f"{VIDEO_MAX_KBPS}k",
        "-bufsize", f"{VIDEO_MAX_KBPS * 3}k", "-pix_fmt", "yuv420p", "-profile:v", "main",
        "-level", "3.1", "-movflags", "+faststart", str(video),
    ]
    subprocess.run(command, check=True)
    poster = out_dir / f"{clip['id']}-poster.jpg"
    subprocess.run(
        [ffmpeg, "-y", "-loglevel", "error", "-ss", str(POSTER_AT_SECONDS), "-i", str(video),
         "-frames:v", "1", "-q:v", "4", str(poster)],
        check=True,
    )
    return {"video": video, "poster": poster}


def manifest_entry(
    clip: Record,
    sources: dict[str, Record],
    rows: list[Record],
    files: dict[str, Path],
    length_s: float,
) -> Record:
    used = {row["source"] for row in rows}
    return {
        "file": files["video"].name,
        "poster": files["poster"].name,
        "title": clip["title"],
        "length_s": round(length_s, 1),
        "size_bytes": files["video"].stat().st_size,
        "distribution": clip["distribution"],
        "illustrative": ILLUSTRATIVE_NOTE,
        "rise_onset_s": onset(rows, ("rising",)),
        "flood_onset_s": onset(rows, ("flood", "extreme")),
        "pieces": [
            {
                "source": row["source"],
                "role": row["role"],
                "starts_s": row["starts_s"],
                "seconds": row["seconds"],
                "source_range_s": [row["start"], row["end"]],
                "speed": row.get("speed", 1),
                "pingpong": bool(row.get("pingpong")),
                "real_footage_of": sources[row["source"]]["event"],
            }
            for row in rows
            if row["starts_s"] < CLIP_SECONDS
        ],
        "sources": {
            source_id: {
                key: sources[source_id][key]
                for key in ("credit", "licence", "page", "distribution")
            }
            for source_id in sorted(used)
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--local", action="store_true", help="build every clip into .demo/clips/")
    parser.add_argument("--plan", action="store_true", help="print each clip's timeline and stop")
    args = parser.parse_args()

    spec = json.loads(SOURCE_LIST.read_text())
    sources, clips = spec["sources"], spec["clips"]
    try:
        validate(sources, clips)
    except SourceListError as error:
        raise SystemExit(f"source list: {error}") from error
    if not args.local:
        clips = [clip for clip in clips if clip["distribution"] == "committed"]
    for clip in clips:
        pieces = expand(clip["pieces"])
        rows = timeline(pieces)
        length = total_seconds(pieces)
        flood_onset = onset(rows, ("flood", "extreme"))
        print(f"{clip['id']}: {length:.1f} s planned, flood onset {flood_onset}")
        for row in rows:
            print(f"    {row['starts_s']:6.1f}  {row['seconds']:5.1f} s  {row['role']:8}"
                  f" {row['source']}")
        if length < CLIP_SECONDS:
            raise SystemExit(f"{clip['id']} plans {length:.1f} s, under {CLIP_SECONDS} s")
    if args.plan:
        return

    ffmpeg = find_ffmpeg()
    started = time.monotonic()
    out_dir = LOCAL_DIR if args.local else COMMITTED_DIR
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = {}
    for source_id in sorted({p["source"] for clip in clips for p in clip["pieces"]}):
        paths[source_id] = download(source_id, sources[source_id])
        print(f"source {source_id}: {paths[source_id].stat().st_size / 1e6:.1f} MB", flush=True)
    for clip in clips:
        for piece in clip["pieces"]:
            have = probe_seconds(ffmpeg, paths[piece["source"]])
            if piece["end"] > have + 0.05:
                raise SystemExit(f"{clip['id']}: {piece['source']} is {have:.1f} s, too short")

    entries = {}
    for clip in clips:
        clip_started = time.monotonic()
        files = render(ffmpeg, clip, sources, paths, out_dir)
        entry = manifest_entry(
            clip,
            sources,
            timeline(expand(clip["pieces"])),
            files,
            probe_seconds(ffmpeg, files["video"]),
        )
        entries[clip["id"]] = entry
        print(
            f"{clip['id']}: {entry['length_s']} s, {entry['size_bytes'] / 1e6:.1f} MB, "
            f"{time.monotonic() - clip_started:.0f} s to build",
            flush=True,
        )
    shutil.rmtree(SOURCE_CACHE / "prepared", ignore_errors=True)
    manifest = {"clip_seconds": CLIP_SECONDS, "size": f"{WIDTH}x{HEIGHT}", "clips": entries}
    text = json.dumps(manifest, indent=2, ensure_ascii=False)
    (out_dir / "manifest.json").write_text(text + "\n")
    total_mb = sum(e["size_bytes"] for e in entries.values()) / 1e6
    print(f"wrote {out_dir}: {total_mb:.1f} MB in {time.monotonic() - started:.0f} s")


if __name__ == "__main__":
    main()
