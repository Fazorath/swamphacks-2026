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

it("shows only the key places at the national zoom", () => {
  expect(names(6)).toEqual(["Kathmandu", "Syabrubesi"]);
});

it("brings the cities in on zoom and the villages in over the valley", () => {
  expect(names(8)).toEqual(["Kathmandu", "Syabrubesi", "Pokhara"]);
  expect(names(11)).toEqual(["Kathmandu", "Syabrubesi", "Pokhara", "Tiny village"]);
});

it("leaves out a place outside what the map shows", () => {
  expect(names(11, [90, 26, 91, 31])).toEqual([]);
});
