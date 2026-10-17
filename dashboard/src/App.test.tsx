import { render, screen } from "@testing-library/react";

import { App } from "./App";

class FakeEventSource {
  onmessage: ((event: { data: string }) => void) | null = null;
  constructor() {
    queueMicrotask(() =>
      this.onmessage?.({
        data: JSON.stringify([
          {
            kind: "pressure",
            value: 1015,
            unit: "hPa",
            timestamp: "2026-10-16T12:00:00Z",
            simulated: true,
          },
        ]),
      }),
    );
  }
  close() {}
}

beforeEach(() => {
  vi.stubGlobal("fetch", async () => Response.json({ name: "porch", role: "hub" }));
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
  expect(screen.getByText("(simulated)")).toBeInTheDocument();
});
