import { act, render, screen } from "@testing-library/react";

import { App } from "./App";
import { expandPanel } from "./expandPanel";
import { fakeNodeState } from "./fakeNodeState";
import { POLL_EVERY_MS } from "./usePolledJson";

let nodeStatus: "online" | "mesh_only";
let nodeReachable: boolean;

beforeEach(() => {
  nodeStatus = "online";
  nodeReachable = true;
  vi.stubGlobal("fetch", async (path: string) => {
    if (!nodeReachable) throw new TypeError("Failed to fetch");
    if (path === "/api/cameras") return Response.json([]);
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

test("the header says the Node is Online", async () => {
  render(<App />);
  expandPanel("Cameras");
  expect(await screen.findByText("Online")).toBeInTheDocument();
  expect(screen.queryByText("Mesh-only")).not.toBeInTheDocument();
});

test("the header says Mesh-only when the Node has no internet", async () => {
  nodeStatus = "mesh_only";
  render(<App />);
  expandPanel("Cameras");
  expect(await screen.findByText("Mesh-only")).toBeInTheDocument();
  expect(screen.queryByText("Online")).not.toBeInTheDocument();
});

test("a failed poll leaves the badge as it was", async () => {
  render(<App />);
  expect(await screen.findByText("Online")).toBeInTheDocument();
  nodeReachable = false;
  await nextPoll();
  expect(screen.getByText("Online")).toBeInTheDocument();
});
