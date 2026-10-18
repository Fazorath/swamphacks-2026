import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

// Whether a Panel shows its content, and the way to flip it; App holds it so a warning can open
// the Alerts and the Evacuation Plan Panels on its own.
export type PanelControl = { open: boolean; onToggle: () => void };

export function Panel({
  label,
  open,
  onToggle,
  children,
}: PanelControl & { label: string; children: ReactNode }) {
  return (
    <section aria-label={label} className={open ? "panel" : "panel collapsed"}>
      <div className="panel-head">
        <h2>{label}</h2>
        <button
          type="button"
          className="panel-chevron"
          aria-expanded={open}
          aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
          onClick={onToggle}
        >
          <ChevronDown size={16} aria-hidden="true" />
        </button>
      </div>
      {open && <div className="panel-body">{children}</div>}
    </section>
  );
}
