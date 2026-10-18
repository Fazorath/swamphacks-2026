import { useMemo, useState } from "react";

import { AlertsPanel } from "./AlertsPanel";
import { firstSurgeAt } from "./communityWarnings";
import { CamerasPanel } from "./CamerasPanel";
import { EvacuationPlanPanel } from "./EvacuationPlanPanel";
import { evacuationPlan } from "./evacuationPlan";
import { HouseholdPanel } from "./HouseholdPanel";
import { HubPanel } from "./HubPanel";
import type { Home } from "./householdProfile";
import { NodeMap } from "./NodeMap";
import { NodePanel } from "./NodePanel";
import { usePlaces } from "./placeLabels";
import { nodesOnMap } from "./nodesOnMap";
import { ReadingsPanel } from "./ReadingsPanel";
import { StatusStrip } from "./StatusStrip";
import { TopBar } from "./TopBar";
import { blockedRoadLines, roadNear } from "./rerouting";
import { useBlockedRoads } from "./useBlockedRoads";
import { useCachePack } from "./useCachePack";
import { useCameras } from "./useCameras";
import { useEventClock } from "./useEventClock";
import { exampleHousehold } from "./exampleHousehold";
import { useHouseholdProfile, type StorageProblem } from "./useHouseholdProfile";
import { PagerBanner } from "./PagerBanner";
import { useNodeState } from "./useNodeState";
import { usePager } from "./usePager";
import { useOpenShelterIds } from "./useOpenShelterIds";
import { useRoadGraph } from "./useRoadGraph";
import { useRiverLine } from "./useRiverLine";
import { useRoutes } from "./useRoutes";
import { waveArrival } from "./waveEta";

// Only the person at the Node's own machine may change that Node's registration; a phone cannot.
function onThisNodesOwnMachine(): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
}

const STORAGE_PROBLEM_MESSAGES: Record<StorageProblem, string> = {
  unreadable:
    "Your saved household profile could not be read, so it is treated as missing. It was not deleted.",
  unsaved: "Your household profile will not be remembered after you close this page.",
};

type PanelName = "readings" | "alerts" | "plan" | "cameras";

// A calm day shows the Readings and nothing else (D-50); a warning or an Alert opens the Alerts
// and the Evacuation Plan.
const CALM_PANELS: Record<PanelName, boolean> = {
  readings: true,
  alerts: false,
  plan: false,
  cameras: false,
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
  const pager = usePager(nodes, profile?.home ?? null);
  const cachePack = useCachePack();
  const [openShelterIds, showOpenShelterIds] = useOpenShelterIds();
  // Until a resident saves their own profile, an example home keeps the plan and Route on screen.
  const example = profile === null ? exampleHousehold(cachePack) : null;
  const shownProfile = profile ?? example;
  const routes = useRoutes(shownProfile?.home ?? null, cachePack?.routeGrid ?? null);
  const roadGraph = useRoadGraph(cachePack !== null);
  const river = useRiverLine(cachePack !== null);
  const [blockedRoads, toggleBlockedRoad] = useBlockedRoads();
  const [blocking, setBlocking] = useState(false);
  const blockedLines = useMemo(
    () => (roadGraph ? blockedRoadLines(roadGraph, blockedRoads) : []),
    [roadGraph, blockedRoads],
  );
  const tapRoad = (point: Home) => {
    const road = roadGraph && roadNear(roadGraph, point);
    if (road) toggleBlockedRoad(road);
  };
  // Kept while unreachable: each carries its own issue time, and losing an evacuation order to a
  // Wi-Fi drop is worse than showing one a few seconds old.
  const officialAlerts = lastAnswer?.state.official_alerts ?? [];
  const communityWarnings = lastAnswer?.state.community_warnings ?? [];
  // The home never leaves the device: the profile's, or else where the connected Node sits.
  const thisNode = lastAnswer?.state.nodes.find((node) => node.id === lastAnswer.state.id);
  const waveHome: Home | null =
    shownProfile?.home ??
    (thisNode ? { lat: thisNode.position[0], lon: thisNode.position[1] } : null);
  const eventT = eventClock.clock?.event_t ?? null;
  const arrival = river && waveHome && waveArrival(river, waveHome, communityWarnings);
  const planWave =
    arrival && arrival.kind === "expected" && eventT !== null
      ? { arrivalAt: arrival.at, eventT }
      : null;
  const plan = evacuationPlan({
    profile: shownProfile,
    pack: cachePack,
    openShelterIds,
    floodRisk,
    routes,
    rerouting: roadGraph && { graph: roadGraph, blocked: blockedRoads },
    officialAlerts,
    wave: planWave,
  });
  const places = usePlaces(cachePack?.nepal != null);
  const [openPanels, setOpenPanels] = useState(CALM_PANELS);
  const [warned, setWarned] = useState(false);
  const warning = officialAlerts.length > 0 || communityWarnings.length > 0;
  // Opened once, when the first warning arrives; after that the resident's own choices stand.
  if (warning && !warned) {
    setWarned(true);
    setOpenPanels((open) => ({ ...open, alerts: true, plan: true }));
  }
  const panel = (name: PanelName) => ({
    open: openPanels[name],
    onToggle: () => setOpenPanels((open) => ({ ...open, [name]: !open[name] })),
  });
  const [panelOpen, setPanelOpen] = useState(false);
  const [hubPanelOpen, setHubPanelOpen] = useState(false);
  const [nodePanelOpen, setNodePanelOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const [draftHome, setDraftHome] = useState<Home | null>(null);
  // The panels slide in over the same edge, so only one is open at a time.
  const openPanel = () => {
    setHubPanelOpen(false);
    setNodePanelOpen(false);
    setDraftHome(profile?.home ?? null);
    setPanelOpen(true);
  };
  const openHubPanel = () => {
    closePanel();
    setNodePanelOpen(false);
    setHubPanelOpen(true);
  };
  const openNodePanel = () => {
    closePanel();
    setHubPanelOpen(false);
    setNodePanelOpen(true);
  };
  const closePanel = () => {
    setPanelOpen(false);
    setPicking(false);
  };
  return (
    <main>
      <TopBar
        eventClock={eventClock.clock}
        floodRisk={floodRisk}
        status={state?.status ?? null}
        householdSaved={profile !== null}
        onOpenHousehold={openPanel}
        onOpenNode={onThisNodesOwnMachine() && identity ? openNodePanel : null}
        onOpenHub={identity?.role === "hub" ? openHubPanel : null}
      />
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
          shelters={cachePack?.shelters ?? []}
          openShelterIds={openShelterIds}
          onOpenShelterIdsChanged={showOpenShelterIds}
          onClose={() => setHubPanelOpen(false)}
        />
      )}
      {nodePanelOpen && state && (
        <NodePanel
          registration={state.registration}
          onSignedUp={refresh}
          onClose={() => setNodePanelOpen(false)}
        />
      )}
      {pager.alert && <PagerBanner alert={pager.alert} onDismiss={pager.dismiss} />}
      <div className="stage">
        <NodeMap
          nodes={nodes}
          selectedId={selectedId}
          onSelect={toggleSelected}
          home={shownProfile?.home ?? null}
          shelters={cachePack?.shelters ?? []}
          openShelterIds={openShelterIds}
          floodProne={cachePack?.floodProne ?? null}
          nepal={cachePack?.nepal ?? null}
          places={places}
          river={river}
          shelter={plan.shelter}
          outOfReachShelter={plan.outOfReachShelter}
          route={plan.route}
          draftHome={panelOpen ? draftHome : null}
          picking={picking}
          onPickHome={setDraftHome}
          onDonePicking={() => setPicking(false)}
          blockedRoadLines={blockedLines}
          canBlockRoads={roadGraph !== null}
          blocking={blocking}
          onToggleBlocking={() => setBlocking((on) => !on)}
          onTapRoad={tapRoad}
        />
        <div className="panel-column left">
          <ReadingsPanel
            nodes={nodes}
            floodRisk={floodRisk}
            selectedId={selectedId}
            onSelect={toggleSelected}
            onScenarioChanged={refresh}
            panel={panel("readings")}
          />
        </div>
        <div className="panel-column right">
          <AlertsPanel
            alerts={officialAlerts}
            warnings={communityWarnings}
            nodes={lastAnswer?.state.nodes ?? []}
            thisNodeId={lastAnswer?.state.id ?? ""}
            appliesToYouIds={plan.officialAlerts.map((alert) => alert.id)}
            firstCommunityWarningAt={firstSurgeAt(communityWarnings)}
            waveArrival={arrival}
            eventT={eventT}
            online={state?.status === "online"}
            panel={panel("alerts")}
          />
          <EvacuationPlanPanel
            plan={plan}
            exampleHome={example !== null}
            waveArrival={arrival}
            eventT={eventT}
            shelterStatusConfirmedAt={unreachable ? (lastAnswer?.at ?? null) : null}
            panel={panel("plan")}
          />
          <CamerasPanel tiles={cameras} panel={panel("cameras")} />
        </div>
      </div>
      <StatusStrip
        nodes={nodes}
        identity={identity}
        connecting={connection === "connecting"}
        status={state?.status ?? null}
        cameras={cameras}
        cachePackBuilt={cachePack?.built ?? null}
        cachePackLoaded={cachePack !== null}
        nepal={cachePack?.nepal ?? null}
      />
    </main>
  );
}
