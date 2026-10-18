import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

import { forgetMaps } from "./fakeMaplibre";

vi.mock("maplibre-gl", () => import("./fakeMaplibre"));

// The open Panels are remembered in the browser, so one test's choice must not reach the next.
afterEach(() => {
  forgetMaps();
  window.localStorage.clear();
});
