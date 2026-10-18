import { Gauge, Map, Route, TriangleAlert, type LucideIcon } from "lucide-react";

export type PhoneTab = "map" | "readings" | "alerts" | "plan";

const TABS: { name: PhoneTab; label: string; icon: LucideIcon }[] = [
  { name: "map", label: "Map", icon: Map },
  { name: "readings", label: "Readings", icon: Gauge },
  { name: "alerts", label: "Alerts", icon: TriangleAlert },
  { name: "plan", label: "Plan", icon: Route },
];

export function PhoneTabs({ tab, onChange }: { tab: PhoneTab; onChange: (tab: PhoneTab) => void }) {
  return (
    <nav aria-label="Views" role="tablist" className="phone-tabs">
      {TABS.map(({ name, label, icon: Icon }) => (
        <button
          key={name}
          type="button"
          role="tab"
          aria-selected={tab === name}
          onClick={() => onChange(name)}
        >
          <Icon size={20} aria-hidden="true" />
          {label}
        </button>
      ))}
    </nav>
  );
}
