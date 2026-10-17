import { fireEvent, render, screen, within } from "@testing-library/react";

import { App } from "./App";

const AGE_SECONDS = [2, 40];

class FakeEventSource {
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor() {
    queueMicrotask(() =>
      this.onmessage?.({
        data: JSON.stringify([
          {
            node: "porch",
            kind: "pressure",
            value: 1015,
            unit: "hPa",
            position: [29.652, -82.324],
            timestamp: "2026-10-16T12:00:00Z",
            age_s: AGE_SECONDS[0],
            simulated: true,
          },
          {
            node: "garage",
            kind: "pressure",
            value: 1002,
            unit: "hPa",
            position: [29.654, -82.322],
            timestamp: "2026-10-16T12:00:00Z",
            age_s: AGE_SECONDS[1],
            simulated: true,
          },
        ]),
      }),
    );
  }
  close() {}
}

beforeEach(() => {
  vi.stubGlobal("fetch", async () => Response.json({ id: "porch", name: "porch", role: "hub" }));
  vi.stubGlobal("EventSource", FakeEventSource);
});

test("shows the Node's name and role and the placeholder areas", async () => {
  render(<App />);
  expect(await screen.findByText("porch · Hub")).toBeInTheDocument();
  for (const area of ["Map", "Readings", "Alerts", "Evacuation Plan"]) {
    expect(screen.getByRole("region", { name: area })).toBeInTheDocument();
  }
});

test("lists readings labeled as simulated", async () => {
  render(<App />);
  expect(await screen.findByText(/Pressure: 1015 hPa/)).toBeInTheDocument();
  expect(screen.getAllByText("SIMULATED").length).toBeGreaterThanOrEqual(2);
});

test("lists readings from other Nodes under each Node's name", async () => {
  render(<App />);
  const garage = await screen.findByRole("region", { name: "Node garage" });
  expect(within(garage).getByText(/Pressure: 1002 hPa/)).toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Node porch" })).getByText(/Pressure: 1015 hPa/),
  ).toBeInTheDocument();
});

test("a silent Node is greyed with STALE and its age", async () => {
  render(<App />);
  const garage = await screen.findByRole("region", { name: "Node garage" });
  expect(within(garage).getByText("STALE · 40 s")).toBeInTheDocument();
  const porch = screen.getByRole("region", { name: "Node porch" });
  expect(within(porch).queryByText(/STALE/)).not.toBeInTheDocument();
});

test("selecting a card marks it as the selected Node", async () => {
  render(<App />);
  const garage = await screen.findByRole("region", { name: "Node garage" });
  fireEvent.click(garage);
  expect(garage).toHaveAttribute("aria-current", "true");
  expect(screen.getByRole("region", { name: "Node porch" })).toHaveAttribute(
    "aria-current",
    "false",
  );
});

test("selecting the selected card again clears the selection", async () => {
  render(<App />);
  const garage = await screen.findByRole("region", { name: "Node garage" });
  fireEvent.click(garage);
  fireEvent.click(garage);
  expect(garage).toHaveAttribute("aria-current", "false");
});
