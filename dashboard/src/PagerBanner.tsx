import { distanceInDisplayUnit } from "./displayUnits";
import { useRegion } from "./RegionContext";
import type { PagerAlert } from "./usePager";

export function PagerBanner({ alert, onDismiss }: { alert: PagerAlert; onDismiss: () => void }) {
  const units = useRegion()?.display_units ?? null;
  return (
    <div className="pager-banner" role="alert">
      <strong>{alert.label} reports a High warning.</strong>
      <span>
        It is {distanceInDisplayUnit(alert.km, units, 0)} from your home, so the water may be
        coming.
      </span>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
