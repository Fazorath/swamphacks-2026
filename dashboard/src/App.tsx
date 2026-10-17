import { useState } from "react";

import { AlertsPanel } from "./AlertsPanel";
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
import { useHouseholdProfile, type StorageProblem } from "./useHouseholdProfile";
import { useNodeState } from "./useNodeState";
import { useOpenShelterIds } from "./useOpenShelterIds";
import { useRoutes } from "./useRoutes";

const ROLE_LABELS = { sensor: "Sensor Node", hub: "Hub" } as const;
const STATUS_LABELS = { online: "Online", mesh_only: "Mesh-only" } as const;

const STORAGE_PROBLEM_MESSAGES: Record<StorageProblem, string> = {
  unreadable:
    "Your saved household profile could not be read, so it is treated as missing. It was not deleted.",
  unsaved: "Your household profile will not be remembered after you close this page.",
};

export function App() {
  const { state, lastAnswer, connection, refresh } = useNodeState();
  const unreachable = connection === "unreachable";
  // Still true of the Node while it is unreachable, unlike its readings.
  const identity = lastAnswer?.state ?? null;
  const floodRisk = state?.flood_risk ?? null;
  const eventClock = useEventClock(!unreachable);
  const cameras = useCameras(!unreachable);
  const nodes = nodesOnMap(state);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const toggleSelected = (id: string) => setSelectedId((current) => (current === id ? null : id));
  const { profile, storageProblem, save, remove } = useHouseholdProfile();
  const cachePack = useCachePack();
  const [openShelterIds, showOpenShelterIds] = useOpenShelterIds();
  const routes = useRoutes(profile?.home ?? null, cachePack?.routeGrid ?? null);
  // Kept while unreachable: each carries its own issue time, and losing an evacuation order to a
  // Wi-Fi drop is worse than showing one a few seconds old.
  const officialAlerts = lastAnswer?.state.official_alerts ?? [];
  const plan = evacuationPlan({
    profile,
    pack: cachePack,
    openShelterIds,
    floodRisk,
    routes,
    officialAlerts,
  });
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
            : connection === "connecting" && "Connecting…"}
        </p>
        {state && (
          <span className={`connection-badge ${state.status}`}>{STATUS_LABELS[state.status]}</span>
        )}
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
      {unreachable && (
        <p role="alert" className="banner">
          Node unreachable. Live readings are hidden until it answers again; the map, Shelters and
          your household profile are still here.
        </p>
      )}
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
          hubReachable={!unreachable}
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
          onScenarioChanged={refresh}
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
        <EvacuationPlanPanel
          plan={plan}
          shelterStatusConfirmedAt={unreachable ? (lastAnswer?.at ?? null) : null}
        />
        <AlertsPanel
          alerts={officialAlerts}
          appliesToYouIds={plan.officialAlerts.map((alert) => alert.id)}
          // Community Warnings arrive with ticket 0013; until then there is no lead time to show.
          firstCommunityWarningAt={null}
          online={state?.status === "online"}
        />
      </div>
    </main>
  );
}
