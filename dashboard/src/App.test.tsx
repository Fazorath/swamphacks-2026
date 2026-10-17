import { render, screen } from "@testing-library/react";

import { App } from "./App";

const READING = {
  t: 1760650928,
  sim: true,
  pressure_hpa: 1015,
  water_m: 0.2,
  rain_mmh: 0,
  soil_pct: 30,
};

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
  expect(screen.getByText(/Water level: 0.2 m/)).toBeInTheDocument();
  expect(screen.getAllByText("(simulated)")).toHaveLength(4);
});
