import type { PagerAlert } from "./usePager";

export function PagerBanner({ alert, onDismiss }: { alert: PagerAlert; onDismiss: () => void }) {
  return (
    <div className="pager-banner" role="alert">
      <strong>{alert.label} stopped responding.</strong>
      <span>It is the closest Node to your home, so the water may be close.</span>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  );
}
