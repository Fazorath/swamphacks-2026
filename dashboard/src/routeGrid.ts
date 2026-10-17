import type { Home } from "./householdProfile";

// The Grid the Cache Pack builder laid over the area (`scripts/pack_routes.py`, `RouteGrid`).
export type RouteGrid = { south: number; west: number; lat_step: number; lon_step: number };

export type LatLon = [number, number];

// A Route per open Shelter id, from the Grid point nearest home.
export type Routes = Record<string, LatLon[]>;

// The same rounding as the builder, so a home asks for the file the builder wrote.
export function routeFilePath(grid: RouteGrid, home: Home): string {
  const gx = Math.floor((home.lon - grid.west) / grid.lon_step + 0.5);
  const gy = Math.floor((home.lat - grid.south) / grid.lat_step + 0.5);
  return `routes/${gx}_${gy}.json`;
}
