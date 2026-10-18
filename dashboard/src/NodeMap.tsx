import "maplibre-gl/dist/maplibre-gl.css";

import { House, MapPin } from "lucide-react";
import { LngLatBounds, Map as MapLibreMap } from "maplibre-gl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  HATCH_IMAGE,
  NATIONAL_ZOOM,
  VALLEY_ZOOM,
  addNepalBasemap,
  baseStyle,
  hatchImage,
  lineCollection,
  readMapColors,
  setOverlay,
  type MapColors,
} from "./basemap";
import { nepalClockTime } from "./EventClockTag";
import { MapMarker } from "./MapMarker";
import {
  estimatedLabelSize,
  placeLabels,
  samePlacement,
  type MapLabel,
  type Placement,
  type Side,
} from "./labelPlacement";
import {
  TERRAIN_EXAGGERATION,
  TERRAIN_FROM_ZOOM,
  TERRAIN_PITCH,
  VALLEY_VIEW,
  createFrameWatch,
  type TerrainChoice,
} from "./terrain";
import { markerState } from "./markerState";
import { NodeMarker } from "./NodeMarker";
import { FLOOD_PRONE_CAPTION, shelterLabel } from "./shelterLabel";
import { visiblePlaces, type Place, type View } from "./placeLabels";
import type { NepalMap, Shelter } from "./evacuationPlan";
import type { FloodProneAreas } from "./floodProne";
import type { Home } from "./householdProfile";
import type { LatLon } from "./routeGrid";
import type { NodeOnMap } from "./nodesOnMap";
import type { CommunityWarning } from "./communityWarnings";
import type { EventClock } from "./useEventClock";
import { useReducedMotion } from "./useViewport";
import type { RiverLine } from "./waveEta";
import { nodesTheWavePassed, townsTheWaveReached } from "./waveFront";
import { useRiverFlow } from "./useRiverFlow";
import { WaveFrontLayer } from "./WaveFrontLayer";

const NEPAL_CENTRE: [number, number] = [84.1, 28.4];
const NEPAL_SPACE_FOR_PANELS = { top: 40, bottom: 40, left: 320, right: 360 };

// 0 at the national zoom and 1 over the valley: the fleet's dots and labels grow with it.
function zoomBlend(zoom: number): number {
  return Math.min(1, Math.max(0, (zoom - NATIONAL_ZOOM) / (VALLEY_ZOOM - NATIONAL_ZOOM)));
}

function viewOf(map: MapLibreMap): View {
  const bounds = map.getBounds();
  return {
    zoom: map.getZoom(),
    bounds: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
  };
}

// Only these tags stay on a Node's map label; the rest show on hover and in the Readings Panel.
const TAG_WIDTH_PX = 70;

function mapTagCount(node: NodeOnMap): number {
  const contactLost = markerState(node).contactArc !== null;
  return [contactLost, !node.simulated].filter(Boolean).length;
}

// A town the wave reached keeps the time it arrived beside its name (D-21).
function placeLabelText(name: string, waveStamps: Map<string, number>): string {
  const arrivedAt = waveStamps.get(name);
  return arrivedAt === undefined ? name : `${name} ${nepalClockTime(arrivedAt)}`;
}

// Every label that competes for room on screen. None is ever drawn over another: the chosen
// Shelter, the selected Node, key places and real Nodes win, and a label that loses is hidden until
// its marker is hovered. Shelters other than the plan's choice are named only on hover (0078).
function labelsOnScreen(
  map: MapLibreMap,
  view: View,
  places: Place[],
  shelters: Shelter[],
  chosenShelterId: string | undefined,
  nodes: NodeOnMap[],
  selectedId: string | null,
  waveStamps: Map<string, number>,
): MapLabel[] {
  const at = (lat: number, lon: number) => map.project([lon, lat]);
  const labels: MapLabel[] = [];
  for (const place of visiblePlaces(places, view)) {
    labels.push({
      id: `place:${place.name}`,
      ...at(place.lat, place.lon),
      ...estimatedLabelSize(placeLabelText(place.name, waveStamps), 12),
      rank: 1,
    });
  }
  const chosen = shelters.find((each) => each.id === chosenShelterId);
  if (chosen) {
    labels.push({
      id: `shelter:${chosen.id}`,
      ...at(chosen.pos[0], chosen.pos[1]),
      ...estimatedLabelSize(shelterLabel(chosen, true), 12),
      rank: 0,
    });
  }
  const fleetShowing = zoomBlend(view.zoom) >= 0.5;
  for (const node of nodes) {
    if (node.fleet && !fleetShowing) continue;
    const text = node.label + (node.waterLevelCm !== null ? ` · ${node.waterLevelCm} cm` : "");
    labels.push({
      id: `node:${node.id}`,
      ...at(node.position[0], node.position[1]),
      ...estimatedLabelSize(text, 13, mapTagCount(node) * TAG_WIDTH_PX),
      rank: node.id === selectedId ? 0 : node.fleet ? 5 : 2,
    });
  }
  return labels;
}

function setTerrainDrawn(map: MapLibreMap, drawn: boolean) {
  if (!map.getSource("elevation")) return;
  if (drawn === (map.getTerrain() !== null)) return;
  map.setTerrain(drawn ? { source: "elevation", exaggeration: TERRAIN_EXAGGERATION } : null);
  if (!drawn && map.getPitch() > 0) map.easeTo({ pitch: 0 });
}

function floodProneCollection(areas: FloodProneAreas | null): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: (areas?.features ?? []).map(({ geometry }) => ({
      type: "Feature",
      properties: {},
      geometry,
    })),
  };
}

// This Node hears itself before it hears anyone else, so a map with no Nepal map is re-framed as
// new Nodes appear, until the resident pans or zooms. After that it is never moved again.
function frameUntilMoved(
  map: MapLibreMap,
  moved: { current: boolean },
  nepal: NepalMap | null,
  nodes: NodeOnMap[],
) {
  if (moved.current) return;
  if (nepal) {
    const [south, west, north, east] = nepal.bbox;
    map.fitBounds(
      [
        [west, south],
        [east, north],
      ],
      { padding: NEPAL_SPACE_FOR_PANELS, animate: false },
    );
  } else if (nodes.length > 0) {
    const bounds = new LngLatBounds();
    for (const {
      position: [lat, lon],
    } of nodes)
      bounds.extend([lon, lat]);
    map.fitBounds(bounds, { padding: 60, maxZoom: 15, animate: false });
  }
}

type Props = {
  nodes: NodeOnMap[];
  // The Simulated Fleet, drawn small beside the Nodes.
  fleet: NodeOnMap[];
  // How often each Node's Flood Risk has risen; a new count plays that Node's ring once.
  rises: Record<string, number>;
  stormSignalOn: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  // The fleet Node whose popover is open (D-38); opening it never touches the Readings Panel.
  fleetOpenId: string | null;
  onToggleFleet: (id: string) => void;
  home: Home | null;
  // From the Cache Pack; empty until a Node holds one.
  shelters: Shelter[];
  openShelterIds: string[];
  floodProne: FloodProneAreas | null;
  nepal: NepalMap | null;
  places: Place[];
  // The valley's own river line, drawn only when the pack has no Nepal rivers.
  river: RiverLine | null;
  // What the wave front needs: the Surges that started it and the Event clock it runs on.
  warnings: CommunityWarning[];
  clock: EventClock | null;
  // False with the Fleet toggle off: the slow dashes on the rivers stop with the fleet.
  ambientFlow: boolean;
  // The Shelter the Evacuation Plan chose.
  shelter: Shelter | null;
  route: LatLon[] | null;
  // Pixels at each edge that open Panels cover.
  panelRoom: { left: number; right: number };
  // The unsaved spot being chosen in the form; the saved Home is `home`.
  draftHome: Home | null;
  picking: boolean;
  onPickHome: (home: Home) => void;
  onDonePicking: () => void;
  blockedRoadLines: LatLon[][];
  // False until the Cache Pack has a Road graph to block roads on.
  canBlockRoads: boolean;
  blocking: boolean;
  onToggleBlocking: () => void;
  onTapRoad: (point: Home) => void;
  // What the resident (and the frame-rate watch) left terrain at; `onTerrainSlow` is that watch.
  terrain: TerrainChoice;
  onTerrainSlow: () => void;
  // Counts presses of the Valley button; each one flies the camera to the valley.
  valleyFlights: number;
};

export function NodeMap({
  nodes,
  fleet,
  rises,
  stormSignalOn,
  selectedId,
  onSelect,
  fleetOpenId,
  onToggleFleet,
  home,
  shelters,
  openShelterIds,
  floodProne,
  nepal,
  places,
  river,
  warnings,
  clock,
  ambientFlow,
  shelter,
  route,
  panelRoom,
  draftHome,
  picking,
  onPickHome,
  onDonePicking,
  blockedRoadLines,
  canBlockRoads,
  blocking,
  onToggleBlocking,
  onTapRoad,
  terrain,
  onTerrainSlow,
  valleyFlights,
}: Props) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [styleReady, setStyleReady] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const colors = useRef<MapColors | null>(null);
  const moved = useRef(false);
  const reducedMotion = useReducedMotion();
  const terrainChoice = useRef(terrain);
  const onTerrainSlowRef = useRef(onTerrainSlow);
  useEffect(() => {
    terrainChoice.current = terrain;
    onTerrainSlowRef.current = onTerrainSlow;
  });
  const [placement, setPlacement] = useState<Placement>(new Map());
  const nodeIds = nodes.map((node) => node.id).join();

  const attach = useCallback((container: HTMLDivElement | null) => {
    if (!container) return;
    colors.current = readMapColors();
    const created = new MapLibreMap({
      container,
      style: baseStyle(colors.current),
      center: NEPAL_CENTRE,
      zoom: NATIONAL_ZOOM,
      attributionControl: false,
      dragRotate: false,
      pitchWithRotate: false,
      // The demo laptop has 8 GB: keep few decoded tiles, elevation ones included.
      maxTileCacheSize: 40,
    });
    const markMoved = () => (moved.current = true);
    container.addEventListener("pointerdown", markMoved);
    container.addEventListener("wheel", markMoved);
    const blendWithZoom = () =>
      container.style.setProperty("--zoom-blend", String(zoomBlend(created.getZoom())));
    created.on("zoom", blendWithZoom);
    created.on("styleimagemissing", ({ id }: { id: string }) => {
      if (id === HATCH_IMAGE && !created.hasImage(id)) {
        created.addImage(id, hatchImage(colors.current!.floodProne));
      }
    });
    // The frame-rate watch listens only while the camera moves and terrain is drawn.
    const frameWatch = createFrameWatch(() => onTerrainSlowRef.current());
    let moving = false;
    created.on("movestart", () => {
      moving = true;
      frameWatch.restart();
    });
    created.on("render", () => {
      if (moving && created.getTerrain()) frameWatch.frame();
    });
    created.on("moveend", () => {
      moving = false;
      setView(viewOf(created));
    });
    // Terrain exists only over the valley; zooming out to the country releases it and flattens
    // the map. Zooming in never tilts it (D-33): only a fly or the Valley button does.
    created.on("zoomend", () => {
      const wanted = terrainChoice.current === "3d" && created.getZoom() >= TERRAIN_FROM_ZOOM;
      setTerrainDrawn(created, wanted);
    });
    created.on("load", () => {
      blendWithZoom();
      setView(viewOf(created));
      setStyleReady(true);
    });
    setMap(created);
    return () => {
      container.removeEventListener("pointerdown", markMoved);
      container.removeEventListener("wheel", markMoved);
      created.remove();
      setMap(null);
      setStyleReady(false);
    };
  }, []);

  useEffect(() => {
    if (!map || !styleReady || !nepal || map.getSource("border")) return;
    addNepalBasemap(map, nepal, colors.current!);
  }, [map, styleReady, nepal]);

  // After the basemap effect above, so the river-flow layer exists when it first looks.
  useRiverFlow(map, styleReady && nepal !== null, ambientFlow && !reducedMotion);

  // The resident's 2D | 3D choice (and a frame-rate drop) applies at once, tilting or flattening.
  useEffect(() => {
    if (!map || !styleReady || !nepal) return;
    const over = map.getZoom() >= TERRAIN_FROM_ZOOM;
    setTerrainDrawn(map, terrain === "3d" && over);
    if (over) map.easeTo({ pitch: terrain === "3d" ? TERRAIN_PITCH : 0 });
  }, [map, styleReady, nepal, terrain]);

  useEffect(() => {
    if (!map || !styleReady || valleyFlights === 0) return;
    moved.current = true;
    map.flyTo({ ...VALLEY_VIEW, pitch: terrain === "3d" && nepal ? TERRAIN_PITCH : 0 });
    // A flight answers a press of the button; changing 2D | 3D later must not fly again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleReady, valleyFlights]);

  useEffect(() => {
    if (map && styleReady) frameUntilMoved(map, moved, nepal, nodes);
    // Re-frame when the set of Nodes or the Nepal map changes, not on every reading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, styleReady, nepal, nodeIds]);

  // A Panel opening must not cover the selected Node, so the map's centre moves to the clear part.
  const selected = nodes.find((node) => node.id === selectedId);
  const selectedLat = selected?.position[0];
  const selectedLon = selected?.position[1];
  useEffect(() => {
    if (!map || !styleReady || selectedLat === undefined || selectedLon === undefined) return;
    map.easeTo({
      center: [selectedLon, selectedLat],
      padding: { top: 0, bottom: 0, left: panelRoom.left, right: panelRoom.right },
    });
  }, [map, styleReady, selectedLat, selectedLon, panelRoom.left, panelRoom.right]);

  const floodProneData = useMemo(() => floodProneCollection(floodProne), [floodProne]);
  const valleyRiverData = useMemo(
    () => lineCollection(nepal ? [] : (river ?? []).map((reach) => reach.points)),
    [nepal, river],
  );
  const routeData = useMemo(() => lineCollection(route ? [route] : []), [route]);
  const blockedData = useMemo(() => lineCollection(blockedRoadLines), [blockedRoadLines]);
  useEffect(() => {
    if (!map || !styleReady) return;
    setOverlay(map, "flood-prone", floodProneData);
    setOverlay(map, "valley-river", valleyRiverData);
    setOverlay(map, "route", routeData);
    setOverlay(map, "blocked-roads", blockedData);
  }, [map, styleReady, floodProneData, valleyRiverData, routeData, blockedData]);

  useEffect(() => {
    if (!map) return;
    const onTap = picking
      ? (point: Home) => onPickHome(point)
      : blocking
        ? (point: Home) => onTapRoad(point)
        : null;
    if (!onTap) return;
    const listener = ({ lngLat }: { lngLat: { lat: number; lng: number } }) =>
      onTap({ lat: lngLat.lat, lon: lngLat.lng });
    map.on("click", listener);
    return () => {
      map.off("click", listener);
    };
  }, [map, picking, blocking, onPickHome, onTapRoad]);

  const eventT = clock?.event_t ?? null;
  const waving = river !== null && eventT !== null && warnings.length > 0;
  const wavePassedIds = new Set(waving ? nodesTheWavePassed(river, warnings, nodes, eventT) : []);
  const waveStamps = waving
    ? townsTheWaveReached(
        river,
        warnings,
        places.filter((place) => place.key),
        eventT,
      )
    : new Map<string, number>();

  // Derived during render, from the last placement so a label keeps its side until it must move.
  const labels =
    map && view
      ? labelsOnScreen(
          map,
          view,
          places,
          shelters,
          shelter?.id,
          [...nodes, ...fleet],
          selectedId,
          waveStamps,
        )
      : [];
  const nextPlacement = placeLabels(labels, placement);
  if (!samePlacement(nextPlacement, placement)) setPlacement(nextPlacement);
  const sideOf = (id: string): Side => placement.get(id) ?? "right";

  return (
    <section aria-label="Map" className="map-area">
      {floodProne && floodProne.features.length > 0 && (
        <p className="flood-prone-caption">{FLOOD_PRONE_CAPTION}</p>
      )}
      {picking && (
        <div className="pick-banner">
          Tap the map to place your home
          <button type="button" onClick={onDonePicking}>
            Done
          </button>
        </div>
      )}
      {canBlockRoads && (
        <div className="pick-banner">
          {blocking ? "Tap a road to block it, or a blocked road to clear it" : "Road closed?"}
          <button type="button" onClick={onToggleBlocking}>
            {blocking ? "Done" : "Block a road"}
          </button>
        </div>
      )}
      <div ref={attach} className={picking || blocking ? "node-map picking" : "node-map"} />
      {map && styleReady && (
        <WaveFrontLayer
          map={map}
          river={river}
          warnings={warnings}
          clock={clock}
          reducedMotion={reducedMotion}
        />
      )}
      {map &&
        view &&
        visiblePlaces(places, view)
          .filter((place) => placement.get(`place:${place.name}`) !== null)
          .map((place) => (
            <MapMarker
              key={place.name}
              map={map}
              lat={place.lat}
              lon={place.lon}
              className={
                waveStamps.has(place.name)
                  ? "place-label key wave-reached"
                  : place.key
                    ? "place-label key"
                    : "place-label"
              }
            >
              <span className={`map-label label-${sideOf(`place:${place.name}`)}`}>
                {placeLabelText(place.name, waveStamps)}
              </span>
            </MapMarker>
          ))}
      {map &&
        shelters.map((each) => {
          const open = openShelterIds.includes(each.id);
          const chosen = each.id === shelter?.id;
          return (
            <MapMarker
              key={each.id}
              map={map}
              lat={each.pos[0]}
              lon={each.pos[1]}
              className={chosen ? "shelter-marker" : open ? "shelter-pin" : "shelter-pin closed"}
            >
              <MapPin size={18} aria-hidden="true" />
              <span
                className={`map-label shelter-label label-${sideOf(`shelter:${each.id}`)}${
                  placement.get(`shelter:${each.id}`) == null ? " label-hidden" : ""
                }`}
              >
                {shelterLabel(each, open)}
              </span>
            </MapMarker>
          );
        })}
      {map && draftHome && (
        <MapMarker map={map} lat={draftHome.lat} lon={draftHome.lon} className="home-draft-marker">
          <House size={16} aria-hidden="true" />
        </MapMarker>
      )}
      {map && home && (
        <MapMarker map={map} lat={home.lat} lon={home.lon} className="home-marker">
          <House size={16} aria-hidden="true" />
        </MapMarker>
      )}
      {map &&
        fleet.map((node) => (
          <NodeMarker
            key={node.id}
            map={map}
            node={node}
            selected={false}
            popoverOpen={node.id === fleetOpenId}
            rises={rises[node.id] ?? 0}
            onSelect={onToggleFleet}
            side={sideOf(`node:${node.id}`)}
            labelHidden={placement.get(`node:${node.id}`) === null}
          />
        ))}
      {map &&
        nodes.map((node) => (
          <NodeMarker
            key={node.id}
            map={map}
            node={node}
            selected={node.id === selectedId}
            wavePassed={wavePassedIds.has(node.id)}
            rises={rises[node.id] ?? 0}
            onSelect={onSelect}
            side={sideOf(`node:${node.id}`)}
            labelHidden={placement.get(`node:${node.id}`) === null}
          />
        ))}
      {stormSignalOn && <div className="storm-vignette" aria-hidden="true" />}
    </section>
  );
}
