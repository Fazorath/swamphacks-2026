import { ShieldCheck } from "lucide-react";

import { EventClockTag } from "./EventClockTag";
import { FloodRiskChip } from "./FloodRiskPanel";
import { stormSignalSentence } from "./floodRiskSentences";
import type { FloodRisk, NodeState } from "./nodeState";
import type { EventClock } from "./useEventClock";
import { WarningChip } from "./WarningBand";

const STATUS_LABELS = { online: "Online", mesh_only: "Mesh-only" } as const;

type Props = {
  eventClock: EventClock | null;
  floodRisk: FloodRisk | null;
  showStormSignal: boolean;
  // Set once a warning is acknowledged on this desktop; null otherwise (D-29).
  warningChip: { minutesLeft: number | null; community: boolean; onOpen: () => void } | null;
  status: NodeState["status"] | null;
  // The phone keeps only the logo, the Flood Risk chip and the connection pill.
  phone: boolean;
  householdSaved: boolean;
  onOpenHousehold: () => void;
  // Only the person at the Node's own machine sees this one.
  onOpenNode: (() => void) | null;
  // Only a Hub has this one.
  onOpenHub: (() => void) | null;
};

export function TopBar({
  eventClock,
  floodRisk,
  showStormSignal,
  warningChip,
  status,
  phone,
  householdSaved,
  onOpenHousehold,
  onOpenNode,
  onOpenHub,
}: Props) {
  return (
    <header className="top-bar">
      <h1>
        <ShieldCheck size={20} aria-hidden="true" />
        Storm Shield
      </h1>
      {!phone && <EventClockTag clock={eventClock} />}
      <FloodRiskChip floodRisk={floodRisk} />
      {!phone && warningChip && <WarningChip {...warningChip} />}
      {status && <span className={`connection-badge ${status}`}>{STATUS_LABELS[status]}</span>}
      {!phone && (
        <>
          {showStormSignal && floodRisk?.storm_signal.on && (
            <span className="storm-signal">{stormSignalSentence(floodRisk.storm_signal)}</span>
          )}
          <p className="household-status">
            {householdSaved ? "Household profile saved" : "Fill in your household profile"}
          </p>
          <button type="button" onClick={onOpenHousehold}>
            My household
          </button>
          {onOpenNode && (
            <button type="button" onClick={onOpenNode}>
              Node
            </button>
          )}
          {onOpenHub && (
            <button type="button" onClick={onOpenHub}>
              Hub
            </button>
          )}
        </>
      )}
    </header>
  );
}
