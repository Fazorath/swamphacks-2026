import type { CameraTile } from "./useCameras";

const SECONDS_BEFORE_MINUTES = 90;

function updatedAgo(ageSeconds: number): string {
  return ageSeconds < SECONDS_BEFORE_MINUTES
    ? `${Math.round(ageSeconds)} s ago`
    : `${Math.round(ageSeconds / 60)} min ago`;
}

function Tile({ tile }: { tile: CameraTile }) {
  const name = `Camera ${tile.label}`;
  if (tile.state === "live") {
    // taken_at changes with every new picture, so the browser never reuses an older one.
    return (
      <article aria-label={name} className="camera-tile live">
        <img src={`/api/cameras/${tile.id}.jpg?t=${tile.taken_at}`} alt={tile.label} />
        <p>
          {tile.label} · updated {updatedAgo(tile.age_s ?? 0)}
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

export function CamerasPanel({ tiles }: { tiles: CameraTile[] }) {
  return (
    <section aria-label="Cameras">
      <h2>Cameras</h2>
      {tiles.map((tile) => (
        <Tile key={tile.id} tile={tile} />
      ))}
    </section>
  );
}
