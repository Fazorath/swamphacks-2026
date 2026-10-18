import copy
import json
import sys
from pathlib import Path
from typing import Any

import make_camera_clips as camera_clips
import pytest

SOURCE_LIST = json.loads(camera_clips.SOURCE_LIST.read_text())
COMMITTED_MANIFEST = json.loads((camera_clips.COMMITTED_DIR / "manifest.json").read_text())
COMMITTED_BUDGET_BYTES = 20_000_000


def sources_and_clips() -> tuple[dict[str, Any], list[dict[str, Any]]]:
    spec = copy.deepcopy(SOURCE_LIST)
    return spec["sources"], spec["clips"]


def test_every_clip_in_the_source_list_plans_a_whole_replay_and_passes_its_checks() -> None:
    sources, clips = sources_and_clips()

    camera_clips.validate(sources, clips)

    for clip in clips:
        planned = camera_clips.total_seconds(camera_clips.expand(clip["pieces"]))
        assert planned >= camera_clips.CLIP_SECONDS, clip["id"]


def test_a_source_with_no_credit_is_refused() -> None:
    sources, clips = sources_and_clips()
    sources["wallowa-calm"]["credit"] = "  "

    with pytest.raises(camera_clips.SourceListError, match="no credit"):
        camera_clips.validate(sources, clips)


def test_a_source_with_no_licence_is_refused() -> None:
    sources, clips = sources_and_clips()
    del sources["wallowa-calm"]["licence"]

    with pytest.raises(camera_clips.SourceListError, match="no licence"):
        camera_clips.validate(sources, clips)


@pytest.mark.parametrize(
    "licence", ["CC BY-NC 4.0", "CC BY-SA 4.0", "CC BY-ND 2.0", "All rights reserved"]
)
def test_a_licence_that_limits_redistribution_cannot_be_committed(licence: str) -> None:
    sources, clips = sources_and_clips()
    sources["wallowa-calm"]["licence"] = licence

    with pytest.raises(camera_clips.SourceListError, match="cannot be committed"):
        camera_clips.validate(sources, clips)


def test_a_committed_clip_cannot_use_footage_we_may_not_redistribute() -> None:
    sources, clips = sources_and_clips()
    committed = next(clip for clip in clips if clip["distribution"] == "committed")
    committed["pieces"].append({"source": "gyirong-cctv-1", "start": 0, "end": 5, "role": "flood"})

    with pytest.raises(camera_clips.SourceListError, match="uses local source"):
        camera_clips.validate(sources, clips)


def test_the_flood_onset_is_where_the_first_flood_piece_becomes_visible() -> None:
    pieces = [
        {"source": "a", "start": 0, "end": 40, "role": "calm"},
        {"source": "b", "start": 0, "end": 30, "role": "flood", "onset_in_piece_s": 5},
    ]

    rows = camera_clips.timeline(pieces)

    assert camera_clips.onset(rows, ("flood", "extreme")) == 45.0
    assert camera_clips.onset(rows, ("rising",)) is None


def test_the_committed_clips_are_credited_illustrative_and_fit_the_budget() -> None:
    clips = COMMITTED_MANIFEST["clips"]

    assert len(clips) >= 3
    assert sum(clip["size_bytes"] for clip in clips.values()) < COMMITTED_BUDGET_BYTES
    for clip_id, clip in clips.items():
        assert clip["length_s"] == pytest.approx(camera_clips.CLIP_SECONDS, abs=0.5), clip_id
        assert clip["distribution"] == "committed"
        assert "not filmed at the site" in clip["illustrative"]
        assert (camera_clips.COMMITTED_DIR / clip["file"]).exists()
        assert (camera_clips.COMMITTED_DIR / clip["poster"]).exists()
        assert clip["sources"]
        for credit in clip["sources"].values():
            assert credit["credit"]
            assert camera_clips.COMMITTED_LICENCE.fullmatch(credit["licence"])


def test_the_committed_clips_include_a_flood_a_real_extreme_case_and_a_rise_without_one() -> None:
    clips = COMMITTED_MANIFEST["clips"]

    assert clips["clip-1-calm-then-surge"]["flood_onset_s"] is not None
    extreme = clips["clip-2-extreme-debris-over-road"]
    assert extreme["flood_onset_s"] is not None
    assert any(
        piece["role"] == "extreme" and piece["real_footage_of"] for piece in extreme["pieces"]
    )
    below_flooding = clips["clip-3-rise-below-flooding"]
    assert below_flooding["flood_onset_s"] is None
    assert below_flooding["rise_onset_s"] is not None


def test_a_missing_ffmpeg_says_how_to_install_it(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    monkeypatch.delenv("FFMPEG", raising=False)
    monkeypatch.setenv("PATH", str(tmp_path))
    monkeypatch.setitem(sys.modules, "imageio_ffmpeg", None)

    with pytest.raises(SystemExit) as stopped:
        camera_clips.find_ffmpeg()

    assert "apt install ffmpeg" in str(stopped.value)
    assert "imageio-ffmpeg" in str(stopped.value)
