import type { PagerAlert } from "./usePager";

export function PagerBanner({ alert, onDismiss }: { alert: PagerAlert; onDismiss: () => void }) {
  return (
    <div className="pager-banner" role="alert">
      <strong>{alert.label} reports a High warning.</strong>
      <span>It is {Math.round(alert.km)} km from your home, so the water may be coming.</span>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
