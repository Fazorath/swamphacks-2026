import { render, screen } from "@testing-library/react";

import { App } from "./App";

test("shows the Node's name and role and the placeholder areas", async () => {
  vi.stubGlobal("fetch", async () => Response.json({ name: "porch", role: "hub" }));
  render(<App />);
  expect(await screen.findByText("porch · Hub")).toBeInTheDocument();
  for (const area of ["Map", "Readings", "Alerts", "Evacuation Plan"]) {
    expect(screen.getByRole("region", { name: area })).toBeInTheDocument();
  }
});
