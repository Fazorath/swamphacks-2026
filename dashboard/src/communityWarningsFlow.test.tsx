import { fireEvent, render, screen, within } from "@testing-library/react";

import { App } from "./App";
import type { CommunityWarning } from "./communityWarnings";
import { fakeNodeSnapshot, fakeNodeState } from "./fakeNodeState";
import type { OfficialAlert } from "./officialAlerts";

// 08:37 NPT on 26 Aug 2026 is 02:52 UTC.
const SURGE_T = Date.parse("2026-08-26T02:52:00Z") / 1000;

const WARNING: CommunityWarning = {
  id: 7,
  t: SURGE_T + 3,
  nodes: ["s0"],
  reasons: ["water_surge"],
  origin: "s0",
  origin_km: -12.2,
  surge_t: SURGE_T,
};

const DHM_NOTICE: OfficialAlert = {
  id: "dhm-notice",
  source: "dhm",
  mode: "replay",
  issued: "2026-08-26T09:05:00+05:45",
  headline: "Authorities learn that a major flood has entered the Bhote Koshi",
  applies_to: [],
  url: "https://example.org/notice",
};

function stubNode(role: "hub" | "sensor", warnings: CommunityWarning[], alerts: OfficialAlert[]) {
  const answers: Record<string, unknown> = {
    "/api/state": fakeNodeState({
      id: "porch",
      role,
      community_warnings: warnings,
      official_alerts: alerts,
      nodes: [
        fakeNodeSnapshot("s0", { name: "S0 Lhende", river_km: -12.2 }),
        fakeNodeSnapshot("porch", { river_km: 0 }),
      ],
    }),
    "/api/cache-pack": { available: true, manifest: null },
    "/api/registry": {
      ver: 2,
      nodes: [{ id: "s0", name: "S0 Lhende", status: "registered", last_heard_s: 1 }],
    },
    "/api/warnings": { warnings },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      url in answers ? Response.json(answers[url]) : new Response(null, { status: 404 }),
    ),
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

test("a Community Warning names the Sensor and how far upstream it is, labelled non-official", async () => {
  stubNode("sensor", [WARNING], []);
  render(<App />);

  const card = await screen.findByRole("article", { name: "Community Warning" });
  expect(within(card).getByText("COMMUNITY WARNING · NOT OFFICIAL")).toBeVisible();
  expect(
    within(card).getByText("Water is surging at S0 Lhende, 12.2 km upstream of this Node"),
  ).toBeVisible();
  expect(within(card).getByText("Signed by the Hub · verified")).toBeVisible();
  expect(
    within(card).getByText("Check official sources for any evacuation decision."),
  ).toBeVisible();
  expect(screen.queryByRole("article", { name: "Official Alert" })).toBeNull();
});

test("the lead-time line compares the warning with the first Official Alert", async () => {
  stubNode("sensor", [WARNING], [DHM_NOTICE]);
  render(<App />);

  expect(
    await screen.findByText("Community Warning 08:37 · first Official Alert 09:05"),
  ).toBeVisible();
});

test("the Hub Panel's Warnings tab logs what was sent, with the Node and its River km", async () => {
  stubNode("hub", [WARNING], []);
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Hub" }));
  const panel = screen.getByRole("dialog", { name: "Hub Panel" });
  fireEvent.click(within(panel).getByRole("tab", { name: "Warnings" }));

  const log = await within(panel).findByRole("region", { name: "Warning log" });
  expect(within(log).getByText("08:37")).toBeVisible();
  expect(within(log).getByText("S0 Lhende")).toBeVisible();
  expect(within(log).getByText("River km −12.2")).toBeVisible();
  expect(within(log).getByText("Water is surging")).toBeVisible();
});

test("the Warnings tab says so when nothing was sent", async () => {
  stubNode("hub", [], []);
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Hub" }));
  const panel = screen.getByRole("dialog", { name: "Hub Panel" });
  fireEvent.click(within(panel).getByRole("tab", { name: "Warnings" }));

  expect(await within(panel).findByText(/No Community Warning sent yet/)).toBeVisible();
});
