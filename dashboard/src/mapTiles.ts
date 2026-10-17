const PACK_TILES_DIR = "/api/cache-pack/files/tiles/";
const ONLINE_TILES_DIR = "/api/tiles/";
const TILE_PATH = "{z}/{x}/{y}.png";

export const MAP_CREDIT =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

// `files` is the pack manifest's file list; tiles are listed as `tiles/{z}/{x}/{y}.png`.
export function deepestTileZoom(files: Record<string, string>): number | null {
  const zooms = Object.keys(files)
    .filter((path) => path.startsWith("tiles/"))
    .map((path) => Number(path.split("/")[1]))
    .filter(Number.isFinite);
  return zooms.length > 0 ? Math.max(...zooms) : null;
}

export function tileUrlTemplate(packHasTiles: boolean): string {
  return (packHasTiles ? PACK_TILES_DIR : ONLINE_TILES_DIR) + TILE_PATH;
}

// The pack holds only the demo box up to its top zoom, so a tile outside it 404s and is asked
// for again online. A tile that already came from the online route has nowhere left to go.
export function onlineUrlForMissingPackTile(failedSrc: string): string | null {
  const [, tilePath] = failedSrc.split(PACK_TILES_DIR);
  return tilePath === undefined ? null : ONLINE_TILES_DIR + tilePath;
}
