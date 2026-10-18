import { useSyncExternalStore } from "react";

// Under this the dashboard is the phone layout (ui.md, "Phone"); up to 1200 px it still
// has the desktop's Panels but only one open per side.
const PHONE_QUERY = "(width < 900px)";
const TABLET_QUERY = "(width < 1200px)";

function matches(query: string): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(query).matches;
}

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window.matchMedia !== "function") return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => matches(query),
  );
}

// With reduced motion every change is an instant swap: the components leave their animation
// classes off, not only the stylesheet's media query.
export const usePrefersReducedMotion = () => useMedia("(prefers-reduced-motion: reduce)");
export const useIsPhone = () => useMedia(PHONE_QUERY);
export const useIsTablet = () => useMedia(TABLET_QUERY);
