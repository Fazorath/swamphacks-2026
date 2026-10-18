import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

import { forgetMaps } from "./fakeMaplibre";
import { installFakeViewport, resetViewport } from "./fakeViewport";

vi.mock("maplibre-gl", () => import("./fakeMaplibre"));

installFakeViewport();

// The open Panels are remembered in the browser, so one test's choice must not reach the next.
afterEach(() => {
  forgetMaps();
  resetViewport();
  window.localStorage.clear();
});
