import { visiblePlaces, type Place } from "./placeLabels";

const place = (name: string, kind: string, lon = 85, lat = 28): Place => ({
  name,
  kind,
  lon,
  lat,
});

const WHOLE_REGION: [number, number, number, number] = [80, 26, 89, 31];

const PLACES = [
  place("Kathmandu", "city"),
  place("Syabrubesi", "town"),
  place("Tatopani", "village"),
  place("Tiny hamlet", "hamlet"),
  place("Oddity", "locality"),
];

const names = (zoom: number, bounds = WHOLE_REGION) =>
  visiblePlaces(PLACES, { zoom, bounds }).map(({ name }) => name);

it("names the cities and towns at every zoom", () => {
  expect(names(2)).toEqual(["Kathmandu", "Syabrubesi"]);
});

it("names villages once the map is close, and hamlets closer still", () => {
  expect(names(11)).toEqual(["Kathmandu", "Syabrubesi", "Tatopani"]);
  expect(names(13)).toEqual(["Kathmandu", "Syabrubesi", "Tatopani", "Tiny hamlet"]);
});

it("leaves out a place outside what the map shows", () => {
  expect(names(13, [90, 26, 91, 31])).toEqual([]);
});
