import { act } from "@testing-library/react";

// jsdom has no matchMedia. Tests start as a desktop and call `setViewport` to narrow the screen.
let width = 1440;
let reducedMotion = false;
const listeners = new Set<() => void>();

const BOUNDS: Record<string, number> = { "(width < 900px)": 900, "(width < 1200px)": 1200 };

export function installFakeViewport() {
  window.matchMedia = ((query: string) => ({
    get matches() {
      if (query === "(prefers-reduced-motion: reduce)") return reducedMotion;
      return width < (BOUNDS[query] ?? 0);
    },
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
  })) as unknown as typeof window.matchMedia;
}

export function setViewport(newWidth: number) {
  width = newWidth;
  act(() => listeners.forEach((listener) => listener()));
}

export function setReducedMotion(reduced: boolean) {
  reducedMotion = reduced;
  act(() => listeners.forEach((listener) => listener()));
}

export function resetViewport() {
  width = 1440;
  reducedMotion = false;
  listeners.clear();
}
