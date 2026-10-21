import { useEffect, useState } from "react";

export type Place = { name: string; kind: string; lat: number; lon: number };

// [west, south, east, north], the corners of what the map shows.
export type View = { zoom: number; bounds: [number, number, number, number] };

// The zoom a kind of place is first named at: big places always, smaller ones only once the map is
// close enough that they do not crowd it. A kind not listed is never named.
const NAMED_FROM_ZOOM: Record<string, number> = {
  city: 0,
  town: 0,
  island: 0,
  suburb: 11,
  village: 11,
  hamlet: 13,
};

export function visiblePlaces(places: Place[], { zoom, bounds }: View): Place[] {
  const [west, south, east, north] = bounds;
  return places.filter(
    (place) =>
      zoom >= (NAMED_FROM_ZOOM[place.kind] ?? Infinity) &&
      place.lon >= west &&
      place.lon <= east &&
      place.lat >= south &&
      place.lat <= north,
  );
}

type PlaceFeature = {
  properties: { name: string; kind: string };
  geometry: { coordinates: [number, number] };
};

// Read once, like the pack itself; a pack without a basemap has no file and no labels.
export function usePlaces(hasBasemap: boolean): Place[] {
  const [places, setPlaces] = useState<Place[]>([]);
  useEffect(() => {
    if (!hasBasemap) return;
    let cancelled = false;
    fetch("/api/cache-pack/files/basemap/places.geojson")
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
            lon: geometry.coordinates[0],
            lat: geometry.coordinates[1],
          })),
        );
      })
      .catch((error) => console.error(error));
    return () => {
      cancelled = true;
    };
  }, [hasBasemap]);
  return places;
}
