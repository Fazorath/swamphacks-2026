import { act, fireEvent, render, screen, within } from "@testing-library/react";

import { App } from "./App";

class SilentEventSource {
  onmessage = null;
  close() {}
}

const SHELTERS = [
  { id: "test-gym", name: "Test Gym", pos: [29.66, -82.32] },
  { id: "far-hall", name: "Far Hall", pos: [29.7, -82.32] },
].map((shelter) => ({ ...shelter, special_needs: false, pet_friendly: false }));

let openIds: string[];
let postedBodies: unknown[];
let refusal: string | null;

function stubNode(role: "hub" | "sensor") {
  const answers: Record<string, unknown> = {
    "/api/node": { id: "porch", name: "porch", role },
    "/api/cache-pack": { available: true, manifest: null },
    "/api/cache-pack/files/shelters.json": SHELTERS,
    "/api/cache-pack/files/flood_prone.geojson": { type: "FeatureCollection", features: [] },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (url === "/api/shelters/open") {
        if (refusal) return Response.json({ detail: refusal }, { status: 422 });
        const body = JSON.parse(init?.body as string);
        postedBodies.push(body);
        openIds = body.open
          ? [...openIds, body.id]
          : openIds.filter((openId) => openId !== body.id);
        return Response.json({ open: openIds });
      }
      if (url === "/api/shelters") return Response.json({ open: openIds });
      return url in answers ? Response.json(answers[url]) : new Response(null, { status: 404 });
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  localStorage.clear();
  localStorage.setItem(
    "storm-shield.household-profile",
    JSON.stringify({
      version: 1,
      profile: {
        home: { lat: 29.65, lon: -82.32 },
        housing: "site-built",
        needsSpecialNeedsShelter: false,
        needsPetFriendlyShelter: false,
      },
    }),
  );
  openIds = ["test-gym", "far-hall"];
  postedBodies = [];
  refusal = null;
  vi.stubGlobal("EventSource", SilentEventSource);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("a Sensor Node has no Hub button", async () => {
  stubNode("sensor");
  render(<App />);

  expect(await screen.findByText(/porch · Sensor Node/)).toBeVisible();
  expect(screen.queryByRole("button", { name: "Hub" })).toBeNull();
});

test("the Hub Panel lists every Shelter and closing one posts the right body", async () => {
  stubNode("hub");
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Hub" }));
  const panel = screen.getByRole("dialog", { name: "Hub Panel" });
  expect(await within(panel).findByText("Far Hall")).toBeVisible();
  expect(within(panel).getAllByText("Open")).toHaveLength(2);

  fireEvent.click(within(panel).getByRole("button", { name: "Close Far Hall" }));

  expect(await within(panel).findByRole("button", { name: "Open Far Hall" })).toBeVisible();
  expect(postedBodies).toEqual([{ id: "far-hall", open: false }]);
  expect(within(panel).getByText("Closed")).toBeVisible();
});

test("a closed nearest Shelter changes the plan on the next poll", async () => {
  stubNode("hub");
  render(<App />);
  expect(await screen.findByText(/Nearest open Shelter: Test Gym/)).toBeVisible();

  openIds = ["far-hall"];
  await act(() => vi.advanceTimersByTimeAsync(5000));

  expect(await screen.findByText(/Nearest open Shelter: Far Hall/)).toBeVisible();
});

test("a refused change is shown in the panel and leaves the list as it was", async () => {
  stubNode("hub");
  refusal = "unknown Shelter 'far-hall'";
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Hub" }));
  const panel = screen.getByRole("dialog", { name: "Hub Panel" });
  fireEvent.click(await within(panel).findByRole("button", { name: "Close Far Hall" }));

  expect(await within(panel).findByRole("alert")).toHaveTextContent(
    "Could not close Far Hall: unknown Shelter 'far-hall'",
  );
  expect(within(panel).getAllByText("Open")).toHaveLength(2);
});
