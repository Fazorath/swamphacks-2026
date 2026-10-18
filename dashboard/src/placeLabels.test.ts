import { visiblePlaces, type Place } from "./placeLabels";

const place = (name: string, kind: string, key = false, lon = 85, lat = 28): Place => ({
  name,
  kind,
  key,
  lon,
  lat,
});

const WHOLE_NEPAL: [number, number, number, number] = [80, 26, 89, 31];

const PLACES = [
  place("Kathmandu", "capital", true),
  place("Syabrubesi", "valley town", true),
  place("Pokhara", "city"),
  place("Tiny village", "village"),
];

const names = (zoom: number, bounds = WHOLE_NEPAL) =>
  visiblePlaces(PLACES, { zoom, bounds }).map(({ name }) => name);

it("names only the key places, at every zoom", () => {
  expect(names(6)).toEqual(["Kathmandu", "Syabrubesi"]);
  expect(names(11)).toEqual(["Kathmandu", "Syabrubesi"]);
});

it("leaves out a place outside what the map shows", () => {
  expect(names(11, [90, 26, 91, 31])).toEqual([]);
});
