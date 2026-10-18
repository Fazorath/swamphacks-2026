import { forecastTag } from "./WeatherLegend";

const FETCHED = "2026-10-18T06:00:00Z";
const after = (minutes: number) => Date.parse(FETCHED) + minutes * 60_000;

describe("forecastTag", () => {
  it.each([
    [10, "FORECAST · updated just now"],
    [180, "FORECAST · updated 3 h ago"],
  ])("a forecast %s minutes old is fresh", (minutes, tag) => {
    expect(forecastTag(FETCHED, after(minutes))).toBe(tag);
  });

  it("turns OFFLINE as soon as it is more than 3 hours old", () => {
    expect(forecastTag(FETCHED, after(181))).toBe("OFFLINE · last forecast 3 h old");
    expect(forecastTag(FETCHED, after(300))).toBe("OFFLINE · last forecast 5 h old");
  });

  it("shows no age when the file does not say when it was fetched", () => {
    expect(forecastTag(undefined, after(0))).toBe("FORECAST");
  });
});
