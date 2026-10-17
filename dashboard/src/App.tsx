import { useState } from "react";

import { CamerasPanel } from "./CamerasPanel";
import { EvacuationPlanPanel } from "./EvacuationPlanPanel";
import { EventClockTag } from "./EventClockTag";
import { FloodRiskChip } from "./FloodRiskPanel";
import { evacuationPlan } from "./evacuationPlan";
import { HouseholdPanel } from "./HouseholdPanel";
import { HubPanel } from "./HubPanel";
import type { Home } from "./householdProfile";
import { NodeMap } from "./NodeMap";
import { nodesOnMap } from "./nodesOnMap";
import { ReadingsPanel } from "./ReadingsPanel";
import { useCachePack } from "./useCachePack";
import { useCameras } from "./useCameras";
import { useEventClock } from "./useEventClock";
import { useFloodRisk } from "./useFloodRisk";
import { useHouseholdProfile, type StorageProblem } from "./useHouseholdProfile";
import { useNodeIdentity } from "./useNodeIdentity";
import { useNodeStatus } from "./useNodeStatus";
import { useOpenShelterIds } from "./useOpenShelterIds";
import { useReadings } from "./useReadings";
import { useRoutes } from "./useRoutes";

const ROLE_LABELS = { sensor: "Sensor Node", hub: "Hub" } as const;
const STATUS_LABELS = { online: "Online", mesh_only: "Mesh-only" } as const;

const STORAGE_PROBLEM_MESSAGES: Record<StorageProblem, string> = {
  unreadable:
    "Your saved household profile could not be read, so it is treated as missing. It was not deleted.",
  unsaved: "Your household profile will not be remembered after you close this page.",
};

const PLACEHOLDER_AREAS = ["Alerts"];

export function App() {
  const { identity, failed } = useNodeIdentity();
  const status = useNodeStatus();
  const eventClock = useEventClock();
  const cameras = useCameras();
  const floodRisk = useFloodRisk();
  const nodes = nodesOnMap(useReadings(), identity, floodRisk?.nodes);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const toggleSelected = (id: string) => setSelectedId((current) => (current === id ? null : id));
  const { profile, storageProblem, save, remove } = useHouseholdProfile();
  const cachePack = useCachePack();
  const [openShelterIds, showOpenShelterIds] = useOpenShelterIds();
  const routes = useRoutes(profile?.home ?? null, cachePack?.routeGrid ?? null);
  const plan = evacuationPlan({ profile, pack: cachePack, openShelterIds, floodRisk, routes });
  const [panelOpen, setPanelOpen] = useState(false);
  const [hubPanelOpen, setHubPanelOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [draftHome, setDraftHome] = useState<Home | null>(null);
  // Both panels slide in over the same edge, so only one is open at a time.
  const openPanel = () => {
    setHubPanelOpen(false);
    setDraftHome(profile?.home ?? null);
    setPanelOpen(true);
  };
  const openHubPanel = () => {
    closePanel();
    setHubPanelOpen(true);
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
        {status && <span className={`connection-badge ${status}`}>{STATUS_LABELS[status]}</span>}
        <EventClockTag clock={eventClock} />
        <FloodRiskChip floodRisk={floodRisk} />
        <p className="household-status">
          {profile ? "Household profile saved" : "Fill in your household profile"}
        </p>
        <button type="button" onClick={openPanel}>
          My household
        </button>
        {identity?.role === "hub" && (
          <button type="button" onClick={openHubPanel}>
            Hub
          </button>
        )}
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
      {hubPanelOpen && (
        <HubPanel
          eventClock={eventClock}
          shelters={cachePack?.shelters ?? []}
          openShelterIds={openShelterIds}
          onOpenShelterIdsChanged={showOpenShelterIds}
          onClose={() => setHubPanelOpen(false)}
        />
      )}
      <div className="areas">
        <ReadingsPanel
          nodes={nodes}
          floodRisk={floodRisk}
          selectedId={selectedId}
          onSelect={toggleSelected}
        />
        <CamerasPanel tiles={cameras} />
        <NodeMap
          nodes={nodes}
          selectedId={selectedId}
          onSelect={toggleSelected}
          stormSignal={floodRisk?.storm_signal ?? null}
          home={profile?.home ?? null}
          shelter={plan.shelter}
          route={plan.route}
          draftHome={panelOpen ? draftHome : null}
          picking={picking}
          onPickHome={setDraftHome}
          onDonePicking={() => setPicking(false)}
        />
        <EvacuationPlanPanel plan={plan} />
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
