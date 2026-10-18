import { agoWords } from "./agoWords";
import { Panel, type PanelControl } from "./Panel";
import type { CameraTile } from "./useCameras";

function Tile({ tile }: { tile: CameraTile }) {
  const name = `Camera ${tile.label}`;
  if (tile.state === "live") {
    // taken_at changes with every new picture, so the browser never reuses an older one.
    return (
      <article aria-label={name} className="camera-tile live">
        <img src={`/api/cameras/${tile.id}.jpg?t=${tile.taken_at}`} alt={tile.label} />
        <p>
          {tile.label} · updated {agoWords(tile.age_s ?? 0)}
        </p>
      </article>
    );
  }
  return (
    <article aria-label={name} className={`camera-tile ${tile.state}`}>
      <p>{tile.label}</p>
      <strong>{tile.state === "offline" ? "Offline" : "Unavailable"}</strong>
    </article>
  );
}

export function CamerasPanel({ tiles, panel }: { tiles: CameraTile[]; panel: PanelControl }) {
  return (
    <Panel label="Cameras" {...panel}>
      {tiles.map((tile) => (
        <Tile key={tile.id} tile={tile} />
      ))}
    </Panel>
  );
}
