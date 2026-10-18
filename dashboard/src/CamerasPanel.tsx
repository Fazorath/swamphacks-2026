import { CameraOff, TriangleAlert } from "lucide-react";
import { useEffect, useRef } from "react";

import { nepalClockTime } from "./EventClockTag";
import { Panel, type PanelControl } from "./Panel";
import type { EventClock } from "./useEventClock";
import type { CameraTile } from "./useCameras";

// A browser that drifts further than this from the Event clock is moved back to it.
const MAX_DRIFT_SECONDS = 1.5;

// Where the clip is for this Event clock: the real seconds since the replay began, held inside
// the clip. With no replay running it rests on its first frame.
function clipPosition(clock: EventClock | null, tile: CameraTile): number {
  if (!clock || tile.event_start_t === null || tile.length_s === null) return 0;
  const seconds = (clock.event_t - tile.event_start_t) / clock.rate;
  return Math.min(Math.max(seconds, 0), tile.length_s);
}

function ReplayVideo({ tile, clock }: { tile: CameraTile; clock: EventClock | null }) {
  const video = useRef<HTMLVideoElement>(null);
  const target = clipPosition(clock, tile);
  const playing = clock?.state === "playing" && target < (tile.length_s ?? 0);

  useEffect(() => {
    const element = video.current;
    if (!element) return;
    // A playing clip keeps its own time between polls, so only a jump or a reset moves it.
    if (!playing || Math.abs(element.currentTime - target) > MAX_DRIFT_SECONDS) {
      element.currentTime = target;
    }
    if (playing) {
      element
        .play()
        .catch((error: unknown) => console.warn("the camera clip did not start", error));
    } else {
      element.pause();
    }
  }, [playing, target]);

  return (
    <video
      ref={video}
      src={`/api/cameras/${tile.id}/clip`}
      poster={`/api/cameras/${tile.id}/poster`}
      muted
      playsInline
      preload="auto"
      aria-label={tile.label}
    />
  );
}

// One <article> per camera, kept as the state changes, so a tile going Offline dims and relabels
// where it stands.
function Tile({ tile, clock }: { tile: CameraTile; clock: EventClock | null }) {
  const name = `Camera ${tile.label}`;
  if (tile.state === "offline") {
    return (
      <article aria-label={name} className="camera-tile offline">
        <CameraOff aria-hidden="true" />
        <strong>OFFLINE · internet down</strong>
        <p>{tile.label}</p>
      </article>
    );
  }
  if (tile.state === "unavailable") {
    return (
      <article aria-label={name} className="camera-tile unavailable">
        <TriangleAlert aria-hidden="true" />
        <strong>UNAVAILABLE</strong>
        <p>{tile.label}</p>
      </article>
    );
  }
  return (
    <article aria-label={name} className="camera-tile replay">
      <ReplayVideo tile={tile} clock={clock} />
      <strong className="camera-tag">
        CAMERA · REPLAY{clock ? ` ${nepalClockTime(clock.event_t)} NPT` : ""}
      </strong>
      <p>
        {tile.label} · {tile.illustrative}
      </p>
      <details className="camera-credit">
        <summary>Footage credit</summary>
        {tile.credit}
      </details>
    </article>
  );
}

export function CamerasPanel({
  tiles,
  clock,
  panel,
}: {
  tiles: CameraTile[];
  clock: EventClock | null;
  panel: PanelControl;
}) {
  return (
    <Panel label="Cameras" {...panel}>
      {tiles.map((tile) => (
        <Tile key={tile.id} tile={tile} clock={clock} />
      ))}
    </Panel>
  );
}
