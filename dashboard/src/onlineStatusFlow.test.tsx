import { act, render, screen, within } from "@testing-library/react";

import { App } from "./App";
import { fakeNodeState } from "./fakeNodeState";
import { POLL_EVERY_MS } from "./usePolledJson";

const ARCHER = "I-75 southbound at SR-24 / Archer Rd";
const NEWBERRY = "I-75 southbound at SR-26 / Newberry Rd";

const LIVE_TILES = [
  { id: 1655, label: ARCHER, state: "live", taken_at: "2026-10-17T06:12:00Z", age_s: 12 },
  { id: 1647, label: NEWBERRY, state: "live", taken_at: "2026-10-17T06:10:00Z", age_s: 120 },
];

const OFFLINE_TILES = [
  { id: 1655, label: ARCHER, state: "offline", taken_at: null, age_s: null },
  { id: 1647, label: NEWBERRY, state: "offline", taken_at: null, age_s: null },
];

const ONE_UNAVAILABLE = [
  LIVE_TILES[0],
  { id: 1647, label: NEWBERRY, state: "unavailable", taken_at: null, age_s: null },
];

let nodeStatus: "online" | "mesh_only";
let cameraTiles: object[];
let nodeReachable: boolean;

beforeEach(() => {
  nodeStatus = "online";
  cameraTiles = LIVE_TILES;
  nodeReachable = true;
  vi.stubGlobal("fetch", async (path: string) => {
    if (!nodeReachable) throw new TypeError("Failed to fetch");
    if (path === "/api/cameras") return Response.json(cameraTiles);
    if (path === "/api/state") return Response.json(fakeNodeState({ status: nodeStatus }));
    return new Response(null, { status: 404 });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

async function nextPoll() {
  await act(() => vi.advanceTimersByTimeAsync(POLL_EVERY_MS));
}

function tile(label: string) {
  return screen.getByRole("article", { name: `Camera ${label}` });
}

test("the header says the Node is Online", async () => {
  render(<App />);
  expect(await screen.findByText("Online")).toBeInTheDocument();
  expect(screen.queryByText("Mesh-only")).not.toBeInTheDocument();
});

test("the header says Mesh-only when the Node has no internet", async () => {
  nodeStatus = "mesh_only";
  render(<App />);
  expect(await screen.findByText("Mesh-only")).toBeInTheDocument();
  expect(screen.queryByText("Online")).not.toBeInTheDocument();
});

test("live camera tiles show their picture and how long ago it was taken", async () => {
  render(<App />);
  const archer = await screen.findByRole("article", { name: `Camera ${ARCHER}` });
  expect(within(archer).getByRole("img", { name: ARCHER })).toHaveAttribute(
    "src",
    "/api/cameras/1655.jpg?t=2026-10-17T06:12:00Z",
  );
  expect(within(archer).getByText(`${ARCHER} · updated 12 s ago`)).toBeInTheDocument();
  expect(within(tile(NEWBERRY)).getByText(`${NEWBERRY} · updated 2 min ago`)).toBeInTheDocument();
});

test("when the Node goes Mesh-only the tiles read Offline and show no picture", async () => {
  render(<App />);
  await screen.findByRole("img", { name: ARCHER });
  nodeStatus = "mesh_only";
  cameraTiles = OFFLINE_TILES;
  await nextPoll();
  expect(await screen.findByText("Mesh-only")).toBeInTheDocument();
  expect(within(tile(ARCHER)).getByText("Offline")).toBeInTheDocument();
  expect(within(tile(NEWBERRY)).getByText("Offline")).toBeInTheDocument();
  expect(screen.queryByRole("img", { name: ARCHER })).not.toBeInTheDocument();
});

test("an Unavailable tile is told apart from an Offline one and leaves the others live", async () => {
  cameraTiles = ONE_UNAVAILABLE;
  render(<App />);
  await screen.findByRole("img", { name: ARCHER });
  const broken = tile(NEWBERRY);
  expect(within(broken).getByText("Unavailable")).toBeInTheDocument();
  expect(within(broken).queryByText("Offline")).not.toBeInTheDocument();
  expect(broken).toHaveClass("unavailable");
  expect(tile(ARCHER)).toHaveClass("live");
  cameraTiles = OFFLINE_TILES;
  await nextPoll();
  expect(tile(NEWBERRY)).toHaveClass("offline");
});

test("a failed poll leaves the badge and the tiles as they were", async () => {
  render(<App />);
  await screen.findByRole("img", { name: ARCHER });
  nodeReachable = false;
  await nextPoll();
  expect(screen.getByText("Online")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: ARCHER })).toBeInTheDocument();
});
