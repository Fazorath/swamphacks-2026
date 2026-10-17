const PACK_TILES = "/api/cache-pack/files/tiles/{z}/{x}/{y}.png";
const ONLINE_TILES = "/api/tiles/{z}/{x}/{y}.png";

export const MAP_CREDIT =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

export function tileUrlTemplate(packAvailable: boolean): string {
  return packAvailable ? PACK_TILES : ONLINE_TILES;
}

// The pack holds only the demo box up to its top zoom, so a tile outside it 404s and is asked
// for again online. A tile that already came from the online route has nowhere left to go.
export function onlineUrlForMissingPackTile(failedSrc: string): string | null {
  const [, tilePath] = failedSrc.split("/api/cache-pack/files/tiles/");
  return tilePath === undefined ? null : `/api/tiles/${tilePath}`;
}
