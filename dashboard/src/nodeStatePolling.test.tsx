import { act, fireEvent, render, screen } from "@testing-library/react";

import { App } from "./App";
import { fakeNodeSnapshot, fakeNodeState } from "./fakeNodeState";
import { POLL_EVERY_MS } from "./useNodeState";

let pressure: number;
let stateRequests: number;
// While set, /api/state never answers, like a Node that has stopped responding mid-request.
let hungUp: boolean;

beforeEach(() => {
  pressure = 1015;
  stateRequests = 0;
  hungUp = false;
  vi.stubGlobal("fetch", async (path: string, init?: RequestInit) => {
    if (init?.method === "POST") {
      pressure = 1000;
      return Response.json({ step: "pressure_drop" });
    }
    if (path === "/api/state") {
      stateRequests += 1;
      if (hungUp) return new Promise(() => {});
      return Response.json(
        fakeNodeState({
          nodes: [
            fakeNodeSnapshot("porch", {
              measurements: { pressure: { value: pressure, unit: "hPa" } },
            }),
          ],
        }),
      );
    }
    if (path === "/api/cameras") return Response.json([]);
    return new Response(null, { status: 404 });
  });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

test("the screen follows the Node once a second", async () => {
  render(<App />);
  expect(await screen.findByText(/Pressure: 1015 hPa/)).toBeInTheDocument();
  pressure = 990;
  await act(() => vi.advanceTimersByTimeAsync(POLL_EVERY_MS));
  expect(screen.getByText(/Pressure: 990 hPa/)).toBeInTheDocument();
});

test("a poll that has not been answered is never joined by another", async () => {
  hungUp = true;
  render(<App />);
  await act(() => vi.advanceTimersByTimeAsync(5 * POLL_EVERY_MS));
  expect(stateRequests).toBe(1);
  expect(screen.getByText("Connecting…")).toBeInTheDocument();
});

test("the Scenario step button shows its effect without waiting for the next poll", async () => {
  render(<App />);
  await screen.findByText(/Pressure: 1015 hPa/);
  fireEvent.click(screen.getByRole("button", { name: "Step scenario (n)" }));
  await act(() => vi.advanceTimersByTimeAsync(POLL_EVERY_MS / 10));
  expect(screen.getByText(/Pressure: 1000 hPa/)).toBeInTheDocument();
});
