import { leadTimeLine, type OfficialAlert } from "./officialAlerts";

// 08:37 NPT on 26 Aug 2026, when the replay's Surge starts.
const COLLAPSE = 1787712720;

function alertIssued(issued: string): OfficialAlert {
  return {
    id: issued,
    source: "dhm",
    mode: "replay",
    issued,
    headline: "Test alert",
    applies_to: [],
    url: "https://example.org",
  };
}

test("the lead-time line compares the first Community Warning with the first Official Alert", () => {
  const alerts = [
    alertIssued("2026-08-26T09:15:00+05:45"),
    alertIssued("2026-08-26T09:05:00+05:45"),
  ];
  expect(leadTimeLine(COLLAPSE, alerts)).toBe(
    "Community Warning 08:37 · first Official Alert 09:05",
  );
});

test("the lead-time line waits until both a Community Warning and an Official Alert exist", () => {
  expect(leadTimeLine(null, [alertIssued("2026-08-26T09:05:00+05:45")])).toBeNull();
  expect(leadTimeLine(COLLAPSE, [])).toBeNull();
});
