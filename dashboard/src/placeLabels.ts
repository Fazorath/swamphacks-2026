import { useEffect, useState } from "react";

import { NATIONAL_ZOOM } from "./basemap";

export type Place = { name: string; kind: string; key: boolean; lat: number; lon: number };

// [west, south, east, north], the corners of what the map shows.
export type View = { zoom: number; bounds: [number, number, number, number] };

// Cities come in a little past the national zoom (D-04); villages only over the valley.
const TOWNS_FROM_ZOOM = NATIONAL_ZOOM + 1.5;
const VILLAGES_FROM_ZOOM = 10;

// The labels worth drawing: the key places always, the rest by zoom, and only those in view.
// Each label is a DOM element, so the count has to stay small.
export function visiblePlaces(places: Place[], { zoom, bounds }: View): Place[] {
  const [west, south, east, north] = bounds;
  return places.filter((place) => {
    if (place.lon < west || place.lon > east || place.lat < south || place.lat > north)
      return false;
    if (place.key) return true;
    if (place.kind === "village" || place.kind === "hamlet") return zoom >= VILLAGES_FROM_ZOOM;
    return zoom >= TOWNS_FROM_ZOOM;
  });
}

type PlaceFeature = {
  properties: { name: string; kind: string; key?: boolean };
  geometry: { coordinates: [number, number] };
};

// Read once, like the pack itself; a pack without the Nepal map has no file and no labels.
export function usePlaces(hasNepalMap: boolean): Place[] {
  const [places, setPlaces] = useState<Place[]>([]);
  useEffect(() => {
    if (!hasNepalMap) return;
    let cancelled = false;
    fetch("/api/cache-pack/files/nepal/places.geojson")
      .then((response) => {
        if (!response.ok)
          throw new Error(`Node API returned ${response.status} for places.geojson`);
        return response.json() as Promise<{ features: PlaceFeature[] }>;
      })
      .then(({ features }) => {
        if (cancelled) return;
        setPlaces(
          features.map(({ properties, geometry }) => ({
            name: properties.name,
            kind: properties.kind,
            key: properties.key === true,
            lon: geometry.coordinates[0],
            lat: geometry.coordinates[1],
          })),
        );
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [hasNepalMap]);
  return places;
}
