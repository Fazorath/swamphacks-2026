import { afterEach, expect, test, vi } from "vitest";

import { armPagerSound } from "./pager";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test("a page with no Web Audio logs a warning on the first tap instead of throwing", () => {
  vi.stubGlobal("AudioContext", undefined);
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const disarm = armPagerSound();

  expect(() => window.dispatchEvent(new Event("pointerdown"))).not.toThrow();
  expect(warn).toHaveBeenCalledWith(expect.stringContaining("pager"));
  disarm();
});
