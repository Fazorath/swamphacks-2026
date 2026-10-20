import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

import { forgetMaps } from "./fakeMaplibre";
import { installFakeViewport, resetViewport } from "./fakeViewport";

vi.mock("maplibre-gl", () => import("./fakeMaplibre"));

// jsdom has no canvas, so the weather picture's address is a sum of its pixels: different
// pictures get different addresses, which is all a test needs to tell them apart.
vi.mock("./weatherImageUrl", () => ({
  weatherImageUrl: ({ data }: { data: Uint8ClampedArray }) =>
    `data:fake,${data.reduce((sum, byte, at) => (sum + byte * (at % 251)) % 1_000_000_007, 0)}`,
}));

installFakeViewport();

// The open Panels are remembered in the browser, so one test's choice must not reach the next.
afterEach(() => {
  forgetMaps();
  resetViewport();
  window.localStorage.clear();
});
