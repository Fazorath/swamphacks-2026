import { fireEvent, render, screen, within } from "@testing-library/react";

import { App } from "./App";

const PORCH_AGE_SECONDS = 2;
const GARAGE_AGE_SECONDS = 40;

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
            age_s: PORCH_AGE_SECONDS,
            simulated: true,
          },
          {
            node: "garage",
            kind: "pressure",
            value: 1002,
            unit: "hPa",
            position: [29.654, -82.322],
            timestamp: "2026-10-16T12:00:00Z",
            age_s: GARAGE_AGE_SECONDS,
            simulated: true,
          },
        ]),
      }),
    );
  }
  close() {}
}

const CALM = {
  level: null,
  reasons: [],
  storm_signal: { on: false, nodes: 0, pressure_hpa: null },
  nodes: { porch: null, garage: null },
};

const HIGH = {
  level: "high",
  reasons: [
    { code: "water_high", nodes: 1, value: 90 },
    { code: "rain_heavy", nodes: 2, value: 30 },
    { code: "pressure_falling", nodes: 2, value: 995 },
  ],
  storm_signal: { on: true, nodes: 2, pressure_hpa: 995 },
  nodes: { porch: "high", garage: null },
};

const LOW_FROM_STORM_SIGNAL = {
  level: "low",
  reasons: [{ code: "pressure_falling", nodes: 3, value: 1002 }],
  storm_signal: { on: true, nodes: 3, pressure_hpa: 1002 },
  nodes: { porch: null, garage: null },
};

function stubFloodRisk(floodRisk: object) {
  vi.stubGlobal("fetch", async (path: string) => {
    if (path === "/api/flood-risk") return Response.json(floodRisk);
    if (path === "/api/cameras") return Response.json([]);
    return Response.json({ id: "porch", name: "porch", role: "hub", status: "online" });
  });
}

beforeEach(() => {
  stubFloodRisk(CALM);
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

test("on a calm day no Flood Risk is shown", async () => {
  render(<App />);
  await screen.findByText("porch · Hub");
  expect(screen.queryByRole("region", { name: "Flood Risk" })).not.toBeInTheDocument();
  expect(screen.queryByText(/Flood Risk ·/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Low pressure/)).not.toBeInTheDocument();
});

test("High Flood Risk shows its level in the top bar and its reasons on the card", async () => {
  stubFloodRisk(HIGH);
  render(<App />);
  const card = await screen.findByRole("region", { name: "Flood Risk" });
  expect(within(card).getByText("Flood Risk · High")).toBeInTheDocument();
  expect(within(card).getByText("water level 90 cm at 1 Node")).toBeInTheDocument();
  expect(within(card).getByText("heavy rain: 30 mm/h at 2 Nodes")).toBeInTheDocument();
  expect(screen.getAllByText("Flood Risk · High")).toHaveLength(2);
});

test("the Storm Signal sits on the map and the card leaves it out when other reasons exist", async () => {
  stubFloodRisk(HIGH);
  render(<App />);
  const map = await screen.findByRole("region", { name: "Map" });
  expect(await within(map).findByText("Low pressure: 995 hPa at 2 Nodes")).toBeInTheDocument();
  const card = screen.getByRole("region", { name: "Flood Risk" });
  expect(within(card).queryByText(/low pressure/)).not.toBeInTheDocument();
});

test("the card repeats the Storm Signal when it is the only reason for Low", async () => {
  stubFloodRisk(LOW_FROM_STORM_SIGNAL);
  render(<App />);
  const card = await screen.findByRole("region", { name: "Flood Risk" });
  expect(within(card).getByText("Flood Risk · Low")).toBeInTheDocument();
  expect(within(card).getByText("low pressure: 1002 hPa at 3 Nodes")).toBeInTheDocument();
});

test("a Node at High shows its own level word and a Node with no level shows none", async () => {
  stubFloodRisk(HIGH);
  render(<App />);
  const porch = await screen.findByRole("region", { name: "Node porch" });
  expect(await within(porch).findByText("HIGH")).toBeInTheDocument();
  const garage = screen.getByRole("region", { name: "Node garage" });
  expect(within(garage).queryByText("HIGH")).not.toBeInTheDocument();
});
