import { act, render, screen, within } from "@testing-library/react";

import { App } from "./App";
import { expandPanel } from "./expandPanel";
import { fakeCameraTile, REPLAY_START_T } from "./fakeCameraTile";
import { fakeNodeState } from "./fakeNodeState";
import { POLL_EVERY_MS } from "./usePolledJson";
import type { CameraTile } from "./useCameras";

// The Event clock polls once a second in the dashboard.
const CLOCK_POLL_MS = 1000;
const RATE = 30;

let tiles: CameraTile[];
let replay: object;
let nodeStatus: "online" | "mesh_only";
const requested: string[] = [];

// Event time after the given number of real seconds of replay.
const afterReplaySeconds = (seconds: number) => REPLAY_START_T + seconds * RATE;
const playingAt = (seconds: number) => ({
  state: "playing",
  event_t: afterReplaySeconds(seconds),
  rate: RATE,
});

beforeEach(() => {
  tiles = [fakeCameraTile()];
  replay = { state: "stopped", event_t: 0, rate: 1 };
  nodeStatus = "online";
  requested.length = 0;
  vi.stubGlobal("fetch", async (path: string) => {
    requested.push(path);
    if (path === "/api/cameras") return Response.json(tiles);
    if (path === "/api/replay") return Response.json(replay);
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

async function nextClockPoll() {
  await act(() => vi.advanceTimersByTimeAsync(CLOCK_POLL_MS));
}

async function nextPoll() {
  await act(() => vi.advanceTimersByTimeAsync(POLL_EVERY_MS));
}

async function showTile(name = "Camera Betrawati") {
  render(<App />);
  expandPanel("Cameras");
  return screen.findByRole("article", { name });
}

const video = (tile: HTMLElement) => within(tile).getByLabelText("Betrawati") as HTMLVideoElement;

test("a working camera is a replay: tagged, credited and called illustrative", async () => {
  const tile = await showTile();
  expect(tile).toHaveClass("replay");
  expect(within(tile).getByText("CAMERA · REPLAY")).toBeInTheDocument();
  expect(
    within(tile).getByText(/Illustrative footage, not filmed at this site/),
  ).toBeInTheDocument();
  expect(within(tile).getByText("Wallowa River, BLM; Bright Angel, NPS")).toBeInTheDocument();
  expect(within(tile).queryByText(/LIVE/)).not.toBeInTheDocument();
});

test("the clip plays muted and inline, with its poster, without a tap", async () => {
  replay = playingAt(10);
  const tile = await showTile();
  await nextClockPoll();
  const clip = video(tile);
  expect(clip).toHaveAttribute("src", "/api/cameras/hub-betrawati/clip");
  expect(clip).toHaveAttribute("poster", "/api/cameras/hub-betrawati/poster");
  expect(clip.muted).toBe(true);
  expect(clip).toHaveAttribute("playsinline");
  expect(clip.paused).toBe(false);
});

test("the tile shows the Event time in Nepal time", async () => {
  replay = playingAt(96);
  const tile = await showTile();
  await nextClockPoll();
  // 96 real seconds at ×30 is 48 event minutes after 08:30.
  expect(within(tile).getByText("CAMERA · REPLAY 09:18 NPT")).toBeInTheDocument();
});

test("the clip's time follows the Event clock, through a pause, a jump and a reset", async () => {
  replay = playingAt(20);
  const tile = await showTile();
  await nextClockPoll();
  expect(video(tile).currentTime).toBeCloseTo(20);
  expect(video(tile).paused).toBe(false);

  replay = { ...playingAt(45), state: "paused" };
  await nextClockPoll();
  expect(video(tile).currentTime).toBeCloseTo(45);
  expect(video(tile).paused).toBe(true);

  replay = playingAt(193);
  await nextClockPoll();
  expect(video(tile).currentTime).toBeCloseTo(193);
  expect(video(tile).paused).toBe(false);

  replay = { ...playingAt(0), state: "paused" };
  await nextClockPoll();
  expect(video(tile).currentTime).toBe(0);
  expect(video(tile).paused).toBe(true);
});

test("a clip that drifts a little is left alone, a big gap is corrected", async () => {
  replay = playingAt(20);
  const tile = await showTile();
  await nextClockPoll();
  video(tile).currentTime = 20.8;
  replay = playingAt(21);
  await nextClockPoll();
  expect(video(tile).currentTime).toBeCloseTo(20.8);
  video(tile).currentTime = 26;
  replay = playingAt(22);
  await nextClockPoll();
  expect(video(tile).currentTime).toBeCloseTo(22);
});

test("the clip holds its last frame after it ends and its first before it starts", async () => {
  replay = playingAt(400);
  const tile = await showTile();
  await nextClockPoll();
  expect(video(tile).currentTime).toBe(300);
  expect(video(tile).paused).toBe(true);

  replay = { ...playingAt(0), event_t: REPLAY_START_T - 600 };
  await nextClockPoll();
  expect(video(tile).currentTime).toBe(0);
});

test("with no replay running the tile rests on its poster and shows no time", async () => {
  const tile = await showTile();
  await nextClockPoll();
  expect(video(tile).currentTime).toBe(0);
  expect(video(tile).paused).toBe(true);
  expect(within(tile).getByText("CAMERA · REPLAY")).toBeInTheDocument();
});

test("a Mesh-only Node shows Offline in the same tile and requests no clip", async () => {
  replay = playingAt(20);
  const tile = await showTile();
  expect(tile).toHaveClass("replay");
  tiles = [fakeCameraTile({ state: "offline", credit: null, illustrative: null })];
  nodeStatus = "mesh_only";
  await nextPoll();
  expect(await within(tile).findByText("OFFLINE · internet down")).toBeInTheDocument();
  expect(screen.getByRole("article", { name: "Camera Betrawati" })).toBe(tile);
  expect(tile).toHaveClass("offline");
  expect(within(tile).queryByLabelText("Betrawati")).not.toBeInTheDocument();
  expect(document.querySelector("video")).toBeNull();
});

test("an Unavailable tile says so and is not mistaken for Offline", async () => {
  tiles = [fakeCameraTile({ state: "unavailable", credit: null, illustrative: null })];
  const tile = await showTile();
  expect(await within(tile).findByText("UNAVAILABLE")).toBeInTheDocument();
  expect(within(tile).queryByText(/OFFLINE/)).not.toBeInTheDocument();
  expect(tile).toHaveClass("unavailable");
  expect(document.querySelector("video")).toBeNull();
});

test("the Cameras button counts cameras playing", async () => {
  replay = playingAt(10);
  render(<App />);
  const rail = within(screen.getByRole("navigation", { name: "Layers" }));
  expect(await rail.findByRole("button", { name: "Cameras, 1" })).toBeVisible();

  replay = { ...playingAt(10), state: "paused" };
  await nextClockPoll();
  expect(await rail.findByRole("button", { name: "Cameras, 0" })).toBeVisible();
});
