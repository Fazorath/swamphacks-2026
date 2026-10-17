import { TriangleAlert } from "lucide-react";

import { reasonsSentence, riverKm, type CommunityWarning } from "./communityWarnings";
import { nepalClockTime } from "./EventClockTag";
import type { RegistrySummary } from "./RegistryTab";

// The answer of the Hub's GET /api/warnings: everything it sent since it started, newest first.
export type WarningLog = { warnings: CommunityWarning[] };

export function WarningsTab({
  log,
  registry,
}: {
  log: WarningLog | null;
  registry: RegistrySummary | null;
}) {
  if (!log) return <p>Loading the warning log…</p>;
  if (log.warnings.length === 0) {
    return (
      <div className="empty-panel">
        <span className="empty-panel-icon">
          <TriangleAlert size={20} aria-hidden="true" />
        </span>
        <p>No Community Warning sent yet. One goes out when a Registered Node reports a Surge.</p>
      </div>
    );
  }
  return (
    <section aria-label="Warning log">
      <ul className="registry-list">
        {log.warnings.map((warning) => {
          const name = registry?.nodes.find((row) => row.id === warning.origin)?.name;
          return (
            <li key={warning.id}>
              <strong>{nepalClockTime(warning.surge_t)}</strong>
              <span>{name ?? warning.origin}</span>
              <span>{riverKm(warning.origin_km)}</span>
              <span>{reasonsSentence(warning)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
