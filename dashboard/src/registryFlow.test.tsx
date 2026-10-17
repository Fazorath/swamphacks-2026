import { act, fireEvent, render, screen, within } from "@testing-library/react";

import { App } from "./App";
import { fakeNodeSnapshot, fakeNodeState } from "./fakeNodeState";
import type { NodeState } from "./nodeState";
import type { RegistrySummary } from "./RegistryTab";

let state: NodeState;
let registry: RegistrySummary;
// What polls get; an accept leaves it alone so only the accept's own answer shows the change.
let pollAnswer: RegistrySummary;
let requests: { path: string; body: unknown }[];

function stubNode() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        requests.push({ path: url, body: init.body ? JSON.parse(init.body as string) : null });
      }
      if (url === "/api/state") return Response.json(state);
      if (url === "/api/registry") return Response.json(pollAnswer);
      if (url === "/api/registry/signup") {
        state = { ...state, registration: "waiting" };
        return Response.json({ registration: "waiting" });
      }
      if (url === "/api/registry/accept") {
        registry = {
          ver: registry.ver + 1,
          nodes: registry.nodes.map((row) =>
            row.status === "waiting" ? { ...row, status: "registered" } : row,
          ),
        };
        return Response.json(registry);
      }
      return new Response(null, { status: 404 });
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  requests = [];
  state = fakeNodeState({ role: "hub" });
  registry = {
    ver: 3,
    nodes: [
      { id: "porch", name: "porch", status: "registered", last_heard_s: 1 },
      { id: "91c2e0b47a3d", name: "kitchen", status: "waiting", last_heard_s: 4 },
      { id: "c0ffee000000", name: null, status: "unverified", last_heard_s: 12 },
    ],
  };
  pollAnswer = registry;
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("an Unverified Node's card is tagged NOT COUNTED and sits below the divider", async () => {
  state = fakeNodeState({
    nodes: [
      fakeNodeSnapshot("porch"),
      fakeNodeSnapshot("c0ffee000000", { registered: false, name: null }),
      fakeNodeSnapshot("91c2e0b47a3d", { name: "kitchen" }),
    ],
  });
  stubNode();
  render(<App />);

  const readings = within(await screen.findByRole("region", { name: "Readings" }));
  const unverified = readings.getByRole("region", { name: "Node c0ffee000000" });
  expect(within(unverified).getByText("NOT COUNTED")).toBeVisible();
  expect(unverified).toHaveClass("unverified");
  expect(readings.getByRole("region", { name: "Node kitchen" })).not.toHaveClass("unverified");

  const order = readings
    .getAllByRole("region")
    .map((card) => card.getAttribute("aria-label"))
    .filter((label) => label?.startsWith("Node "));
  expect(order).toEqual(["Node porch", "Node kitchen", "Node c0ffee000000"]);
  expect(readings.getByText("Not counted")).toBeVisible();
});

test("a Registered Node is shown under the name the Hub gave it", async () => {
  state = fakeNodeState({ nodes: [fakeNodeSnapshot("91c2e0b47a3d", { name: "kitchen" })] });
  stubNode();
  render(<App />);

  expect(await screen.findByRole("region", { name: "Node kitchen" })).toBeVisible();
  expect(screen.queryByText("NOT COUNTED")).toBeNull();
});

test("the Node button shows only on this Node's own machine", async () => {
  stubNode();
  vi.stubGlobal("location", { ...window.location, hostname: "100.64.0.7" });
  render(<App />);

  expect(await screen.findByRole("button", { name: "Hub" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Node" })).toBeNull();
});

test("signing up posts to the Node and the panel walks through the three states", async () => {
  state = fakeNodeState({ role: "sensor", registration: "unverified" });
  stubNode();
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Node" }));
  const panel = screen.getByRole("dialog", { name: "Node Panel" });
  expect(within(panel).getByText("UNVERIFIED")).toBeVisible();

  fireEvent.click(within(panel).getByRole("button", { name: "Sign up with the Hub" }));

  expect(await within(panel).findByText("Sign-up sent, waiting for the Hub")).toBeVisible();
  expect(requests).toEqual([{ path: "/api/registry/signup", body: null }]);
  expect(within(panel).queryByRole("button", { name: "Sign up with the Hub" })).toBeNull();

  state = { ...state, registration: "registered" };
  await act(() => vi.advanceTimersByTimeAsync(1500));
  expect(await within(panel).findByText("REGISTERED")).toBeVisible();
});

test("the Registry tab lists every Node with its tag and badges the waiting Sign-ups", async () => {
  stubNode();
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: "Hub" }));
  const panel = screen.getByRole("dialog", { name: "Hub Panel" });

  const kitchen = within(
    await within(panel)
      .findByText("kitchen")
      .then((el) => el.closest("li")!),
  );
  expect(kitchen.getByText("91c2e0b47a3d")).toBeVisible();
  expect(kitchen.getByText(/SIGN-UP WAITING/)).toBeVisible();
  const stranger = within(within(panel).getByText("c0ffee000000").closest("li")!);
  expect(stranger.getByText(/UNVERIFIED/)).toBeVisible();
  expect(within(panel).getByText(/REGISTERED/)).toBeVisible();
  expect(within(panel).getByLabelText("1 Sign-ups waiting")).toBeVisible();
});

test("Accept posts the Node's id and the change shows before the next poll", async () => {
  stubNode();
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Hub" }));
  const panel = screen.getByRole("dialog", { name: "Hub Panel" });

  fireEvent.click(await within(panel).findByRole("button", { name: "Accept kitchen" }));
  await act(() => vi.advanceTimersByTimeAsync(100));

  expect(requests).toEqual([{ path: "/api/registry/accept", body: { id: "91c2e0b47a3d" } }]);
  expect(within(panel).queryByRole("button", { name: "Accept kitchen" })).toBeNull();
  expect(within(panel).getAllByText(/REGISTERED/)).toHaveLength(2);
});

test("an Unverified this-Node stays on top and the divider appears once, above the others", async () => {
  state = fakeNodeState({
    nodes: [
      fakeNodeSnapshot("porch", { registered: false, name: null }),
      fakeNodeSnapshot("91c2e0b47a3d", { name: "kitchen" }),
      fakeNodeSnapshot("c0ffee000000", { registered: false, name: null }),
    ],
  });
  stubNode();
  render(<App />);

  const readings = await screen.findByRole("region", { name: "Readings" });
  expect(await within(readings).findAllByText("Not counted")).toHaveLength(1);
  const cards = within(readings)
    .getAllByRole("region")
    .map((card) => card.getAttribute("aria-label"));
  expect(cards).toEqual(["Node porch", "Node kitchen", "Node c0ffee000000"]);
  const divider = within(readings).getByText("Not counted");
  const lastCard = within(readings).getByRole("region", { name: "Node c0ffee000000" });
  expect(divider.compareDocumentPosition(lastCard) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const kitchen = within(readings).getByRole("region", { name: "Node kitchen" });
  expect(kitchen.compareDocumentPosition(divider) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("an Unverified Node alone, with no card for this Node, gets the divider instead of crashing", async () => {
  state = fakeNodeState({
    nodes: [fakeNodeSnapshot("c0ffee000000", { registered: false, name: null })],
  });
  stubNode();
  render(<App />);

  const readings = await screen.findByRole("region", { name: "Readings" });
  expect(await within(readings).findByText("Not counted")).toBeVisible();
  expect(within(readings).getByRole("region", { name: "Node c0ffee000000" })).toBeVisible();
});
