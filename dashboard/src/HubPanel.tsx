import { useState } from "react";

import type { Shelter } from "./evacuationPlan";
import { ReplayControls } from "./ReplayControls";
import type { EventClock } from "./useEventClock";

type Props = {
  eventClock: EventClock | null;
  shelters: Shelter[];
  openShelterIds: string[];
  onOpenShelterIdsChanged: (openIds: string[]) => void;
  onClose: () => void;
};

async function setShelterOpen(id: string, open: boolean): Promise<string[]> {
  const response = await fetch("/api/shelters/open", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, open }),
  });
  if (!response.ok) {
    const { detail } = await response.json().catch(() => ({ detail: undefined }));
    throw new Error(typeof detail === "string" ? detail : `Node API returned ${response.status}`);
  }
  return (await response.json()).open;
}

export function HubPanel({
  eventClock,
  shelters,
  openShelterIds,
  onOpenShelterIdsChanged,
  onClose,
}: Props) {
  const [changingShelterId, setChangingShelterId] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const setStatus = async (shelter: Shelter, open: boolean) => {
    setChangingShelterId(shelter.id);
    setProblem(null);
    try {
      onOpenShelterIdsChanged(await setShelterOpen(shelter.id, open));
    } catch (error) {
      console.error(error);
      setProblem(
        `Could not ${open ? "open" : "close"} ${shelter.name}: ${(error as Error).message}`,
      );
    } finally {
      setChangingShelterId(null);
    }
  };

  return (
    <aside role="dialog" aria-label="Hub Panel" className="slide-over">
      <h2>Hub</h2>
      <ReplayControls clock={eventClock} />
      <h3>Shelters</h3>
      {shelters.length === 0 && <p>No Shelters yet: this Hub has no Cache Pack.</p>}
      <ul className="shelter-list">
        {shelters.map((shelter) => {
          const open = openShelterIds.includes(shelter.id);
          return (
            <li key={shelter.id}>
              <span>{shelter.name}</span>
              <span className={`shelter-status ${open ? "open" : "closed"}`}>
                {open ? "Open" : "Closed"}
              </span>
              <button
                type="button"
                disabled={changingShelterId !== null}
                aria-label={`${open ? "Close" : "Open"} ${shelter.name}`}
                onClick={() => setStatus(shelter, !open)}
              >
                {open ? "Close" : "Open"}
              </button>
            </li>
          );
        })}
      </ul>
      {problem && <p role="alert">{problem}</p>}
      <div className="actions">
        <button type="button" onClick={onClose}>
          Close panel
        </button>
      </div>
    </aside>
  );
}
