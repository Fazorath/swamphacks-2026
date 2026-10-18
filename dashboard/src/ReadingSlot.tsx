import { useState, type ReactNode } from "react";

import type { Trend } from "./readingTrends";
import { usePrefersReducedMotion } from "./useViewport";

const ARROWS: Record<Trend, string> = { rising: "↑", falling: "↓", steady: "→" };

// One reading in a fixed-width slot. When `value` changes the slot is drawn again from scratch
// (a new key), which flashes it once for 600 ms; the first value it shows does not flash.
export function ReadingSlot({
  value,
  trend,
  className,
  children,
}: {
  value: number;
  trend?: Trend;
  className?: string;
  children: ReactNode;
}) {
  const reducedMotion = usePrefersReducedMotion();
  // Counting changes while rendering, not in an effect: the new key must reach the same commit
  // as the new number, or the flash would start a frame late.
  const [seen, setSeen] = useState({ value, changes: 0 });
  if (seen.value !== value) setSeen({ value, changes: seen.changes + 1 });
  const flashes = seen.changes > 0 && !reducedMotion;
  return (
    <span className="reading-slot">
      <span
        key={seen.changes}
        className={["slot-value", className, flashes && "tick"].filter(Boolean).join(" ")}
      >
        {children}
      </span>
      {trend && (
        <span role="img" aria-label={trend} className={`trend-arrow ${trend}`}>
          {ARROWS[trend]}
        </span>
      )}
    </span>
  );
}
