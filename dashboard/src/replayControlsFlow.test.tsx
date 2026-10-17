import { fireEvent, render, screen, within } from "@testing-library/react";

import { App } from "./App";
import { fakeNodeState } from "./fakeNodeState";

// 08:30 NPT on 26 Aug 2026; each phase is that many minutes on.
const REPLAY_START = 1787712300;
const PHASES = [
  { id: "calm", label: "Calm", event_t: REPLAY_START },
  { id: "collapse", label: "Collapse above the Lhende Khola", event_t: REPLAY_START + 7 * 60 },
];
const INTERNET_CUE = REPLAY_START + 50 * 60;

let replay: object;
let posted: { path: string; body: unknown }[];

beforeEach(() => {
  replay = { v: 1, kind: "replay", state: "stopped", event_t: 0, rate: 1 };
  posted = [];
  vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      posted.push({ path, body: init.body ? JSON.parse(init.body as string) : undefined });
      return Response.json(replay);
    }
    if (path === "/api/replay") return Response.json(replay);
    if (path === "/api/replay/phases") {
      return Response.json({ phases: PHASES, internet_cue_event_t: INTERNET_CUE });
    }
    if (path === "/api/cameras") return Response.json([]);
    if (path === "/api/state") return Response.json(fakeNodeState({ id: "hub", name: "hub" }));
    return new Response(null, { status: 404 });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function openHubPanel() {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: "Hub" }));
  return screen.getByRole("dialog", { name: "Hub Panel" });
}

test("Start posts to the Hub, and Reset is always there", async () => {
  const panel = await openHubPanel();
  fireEvent.click(within(panel).getByRole("button", { name: "Start" }));
  fireEvent.click(within(panel).getByRole("button", { name: "Reset" }));
  expect(posted).toEqual([
    { path: "/api/replay/start", body: undefined },
    { path: "/api/replay/reset", body: undefined },
  ]);
});

test("a playing replay offers Pause and highlights the current phase", async () => {
  replay = { v: 1, kind: "replay", state: "playing", event_t: REPLAY_START + 8 * 60, rate: 30 };
  const panel = await openHubPanel();
  fireEvent.click(await within(panel).findByRole("button", { name: "Pause" }));
  expect(posted[0].path).toBe("/api/replay/pause");
  expect(
    await within(panel).findByRole("button", { name: "Collapse above the Lhende Khola" }),
  ).toHaveAttribute("aria-current", "step");
  expect(within(panel).getByRole("button", { name: "Calm" })).not.toHaveAttribute("aria-current");
});

test("a paused replay offers Resume, and a phase button jumps to it", async () => {
  replay = { v: 1, kind: "replay", state: "paused", event_t: REPLAY_START, rate: 30 };
  const panel = await openHubPanel();
  fireEvent.click(await within(panel).findByRole("button", { name: "Resume" }));
  fireEvent.click(await within(panel).findByRole("button", { name: /Collapse/ }));
  expect(posted).toEqual([
    { path: "/api/replay/resume", body: undefined },
    { path: "/api/replay/jump", body: { phase: "collapse" } },
  ]);
});

test("the Hub Panel says to cut the internet once the Event clock reaches the cue", async () => {
  replay = { v: 1, kind: "replay", state: "playing", event_t: INTERNET_CUE - 60, rate: 30 };
  const panel = await openHubPanel();
  await within(panel).findByRole("button", { name: "Pause" });
  expect(within(panel).queryByText("Cut the internet now")).toBeNull();

  replay = { v: 1, kind: "replay", state: "playing", event_t: INTERNET_CUE, rate: 30 };
  expect(
    await within(panel).findByText("Cut the internet now", {}, { timeout: 3000 }),
  ).toBeVisible();
});

test("Resume at the end of the replay shows why the Hub refused it", async () => {
  replay = { v: 1, kind: "replay", state: "paused", event_t: REPLAY_START + 120 * 60, rate: 30 };
  const panel = await openHubPanel();
  const resume = await within(panel).findByRole("button", { name: "Resume" });
  vi.stubGlobal("fetch", async () =>
    Response.json({ detail: "the replay has ended; Reset or jump to a phase" }, { status: 409 }),
  );
  fireEvent.click(resume);
  expect(await within(panel).findByRole("alert")).toHaveTextContent(
    "Could not resume the replay: the replay has ended; Reset or jump to a phase",
  );
});
