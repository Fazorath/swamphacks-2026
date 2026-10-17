import { render, screen, within } from "@testing-library/react";

import { App } from "./App";

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
            timestamp: "2026-10-16T12:00:00Z",
            simulated: true,
          },
          {
            node: "garage",
            kind: "pressure",
            value: 1002,
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
  vi.stubGlobal("fetch", async (path: string) =>
    Response.json(path === "/api/readings" ? [READING] : { name: "porch", role: "hub" }),
  );
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
  expect(screen.getAllByText("(simulated)")).toHaveLength(2);
});

test("lists readings from other Nodes under each Node's name", async () => {
  render(<App />);
  const garage = await screen.findByRole("region", { name: "Node garage" });
  expect(within(garage).getByText(/Pressure: 1002 hPa/)).toBeInTheDocument();
  expect(
    within(screen.getByRole("region", { name: "Node porch" })).getByText(/Pressure: 1015 hPa/),
  ).toBeInTheDocument();
});
