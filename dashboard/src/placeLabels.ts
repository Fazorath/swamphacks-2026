import { useEffect, useState } from "react";

export type Place = { name: string; kind: string; key: boolean; lat: number; lon: number };

// [west, south, east, north], the corners of what the map shows.
export type View = { zoom: number; bounds: [number, number, number, number] };

// Only the key places are named: every other town and village was clutter over the valley.
export function visiblePlaces(places: Place[], { bounds }: View): Place[] {
  const [west, south, east, north] = bounds;
  return places.filter(
    (place) =>
      place.key &&
      place.lon >= west &&
      place.lon <= east &&
      place.lat >= south &&
      place.lat <= north,
  );
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
