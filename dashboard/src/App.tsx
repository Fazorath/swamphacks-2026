import { useState } from "react";

import { HouseholdPanel } from "./HouseholdPanel";
import type { Home } from "./householdProfile";
import { NodeMap } from "./NodeMap";
import { nodesOnMap } from "./nodesOnMap";
import { ReadingsPanel } from "./ReadingsPanel";
import { useHouseholdProfile, type StorageProblem } from "./useHouseholdProfile";
import { useNodeIdentity } from "./useNodeIdentity";
import { useReadings } from "./useReadings";

const ROLE_LABELS = { sensor: "Sensor Node", hub: "Hub" } as const;

const STORAGE_PROBLEM_MESSAGES: Record<StorageProblem, string> = {
  unreadable:
    "Your saved household profile could not be read, so it is treated as missing. It was not deleted.",
  unsaved: "Your household profile will not be remembered after you close this page.",
};

const PLACEHOLDER_AREAS = ["Alerts", "Evacuation Plan"];

export function App() {
  const { identity, failed } = useNodeIdentity();
  const nodes = nodesOnMap(useReadings(), identity);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const toggleSelected = (id: string) => setSelectedId((current) => (current === id ? null : id));
  const { profile, storageProblem, save, remove } = useHouseholdProfile();
  const [panelOpen, setPanelOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [draftHome, setDraftHome] = useState<Home | null>(null);
  const openPanel = () => {
    setDraftHome(profile?.home ?? null);
    setPanelOpen(true);
  };
  const closePanel = () => {
    setPanelOpen(false);
    setPicking(false);
  };
  return (
    <main>
      <header>
        <h1>Storm Shield</h1>
        <p>
          {identity
            ? `${identity.name} · ${ROLE_LABELS[identity.role]}`
            : failed
              ? "Node unreachable"
              : "Connecting…"}
        </p>
        <p className="household-status">
          {profile ? "Household profile saved" : "Fill in your household profile"}
        </p>
        <button type="button" onClick={openPanel}>
          My household
        </button>
      </header>
      {storageProblem && (
        <p role="alert" className="banner">
          {STORAGE_PROBLEM_MESSAGES[storageProblem]}
        </p>
      )}
      {panelOpen && (
        <HouseholdPanel
          profile={profile}
          home={draftHome}
          hidden={picking}
          onPickHome={() => setPicking(true)}
          onSave={save}
          onDelete={remove}
          onClose={closePanel}
        />
      )}
      <div className="areas">
        <ReadingsPanel nodes={nodes} selectedId={selectedId} onSelect={toggleSelected} />
        <NodeMap
          nodes={nodes}
          selectedId={selectedId}
          onSelect={toggleSelected}
          home={profile?.home ?? null}
          draftHome={panelOpen ? draftHome : null}
          picking={picking}
          onPickHome={setDraftHome}
          onDonePicking={() => setPicking(false)}
        />
        {PLACEHOLDER_AREAS.map((title) => (
          <section key={title} aria-label={title}>
            <h2>{title}</h2>
            <p>Coming soon</p>
          </section>
        ))}
      </div>
    </main>
  );
}
