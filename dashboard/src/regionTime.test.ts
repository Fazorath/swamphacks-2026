import { regionClockTime, regionDate, regionZoneLabel } from "./regionTime";

// 14:06 EDT on 28 Sep 2022 (hurricane Ian's landfall day).
const FORT_MYERS_AFTERNOON = Date.UTC(2022, 8, 28, 18, 6) / 1000;
// 08:41 NPT on 26 Aug 2026.
const NEPAL_MORNING = Date.UTC(2026, 7, 26, 2, 56) / 1000;

test("a Fort Myers time reads in Eastern time with its daylight label", () => {
  expect(regionDate(FORT_MYERS_AFTERNOON, "America/New_York")).toBe("28 Sep 2022");
  expect(regionClockTime(FORT_MYERS_AFTERNOON, "America/New_York")).toBe("14:06");
  expect(regionZoneLabel(FORT_MYERS_AFTERNOON, "America/New_York")).toBe("EDT");
});

test("the label follows the date: standard time in winter", () => {
  expect(regionZoneLabel(Date.UTC(2022, 11, 1) / 1000, "America/New_York")).toBe("EST");
});

test("a Nepal time reads in NPT", () => {
  expect(regionClockTime(NEPAL_MORNING, "Asia/Kathmandu")).toBe("08:41");
  expect(regionZoneLabel(NEPAL_MORNING, "Asia/Kathmandu")).toBe("NPT");
});
