// A stand-in for maplibre-gl in tests: jsdom has no WebGL, so the real map cannot start. It keeps
// what the app handed to the map (sources, layers, markers) so a test can read it back, and
// setup.ts swaps it in for every test file.
type Handler = (event: unknown) => void;
type GeoJsonData = GeoJSON.GeoJSON | string;

type SourceSpec = { type: string; data?: GeoJsonData; tiles?: string[]; url?: string };

class FakeMap {
  readonly container: HTMLElement;
  readonly sources = new Map<string, SourceSpec>();
  readonly layerIds: string[] = [];
  readonly glyphs: string | undefined;
  readonly sprite: string | undefined;
  readonly fitted: unknown[] = [];
  readonly eased: unknown[] = [];
  private readonly handlers = new Map<string, Handler[]>();

  constructor(options: {
    container: HTMLElement;
    style: {
      sources: Record<string, SourceSpec>;
      layers: { id: string }[];
      glyphs?: string;
      sprite?: string;
    };
  }) {
    this.container = options.container;
    this.glyphs = options.style.glyphs;
    this.sprite = options.style.sprite;
    for (const [id, spec] of Object.entries(options.style.sources)) this.sources.set(id, spec);
    for (const { id } of options.style.layers) this.layerIds.push(id);
    maps.push(this);
    queueMicrotask(() => this.emit("load", {}));
  }

  on(type: string, handler: Handler) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
    return this;
  }

  once(type: string, handler: Handler) {
    const once: Handler = (event) => {
      this.off(type, once);
      handler(event);
    };
    return this.on(type, once);
  }

  off(type: string, handler: Handler) {
    this.handlers.set(
      type,
      (this.handlers.get(type) ?? []).filter((each) => each !== handler),
    );
    return this;
  }

  emit(type: string, event: unknown) {
    for (const handler of this.handlers.get(type) ?? []) handler(event);
  }

  addSource(id: string, spec: SourceSpec) {
    this.sources.set(id, spec);
  }

  addLayer(layer: { id: string }, beforeId?: string) {
    const at = beforeId === undefined ? -1 : this.layerIds.indexOf(beforeId);
    if (at === -1) this.layerIds.push(layer.id);
    else this.layerIds.splice(at, 0, layer.id);
  }

  readonly images = new Set<string>();

  addImage(id: string) {
    this.images.add(id);
  }

  hasImage(id: string) {
    return this.images.has(id);
  }

  getSource(id: string) {
    const spec = this.sources.get(id);
    if (!spec) return undefined;
    return {
      setData: (data: GeoJsonData) => {
        spec.data = data;
      },
      updateImage: ({ url }: { url: string }) => {
        spec.url = url;
      },
    };
  }

  // The last layout and paint values the app set, keyed "layer:property".
  readonly layerProperties = new Map<string, unknown>();

  getLayer(id: string) {
    return this.layerIds.includes(id) ? { id } : undefined;
  }

  removeLayer(id: string) {
    this.layerIds.splice(this.layerIds.indexOf(id), 1);
  }

  removeSource(id: string) {
    this.sources.delete(id);
  }

  setLayoutProperty(layer: string, name: string, value: unknown) {
    this.layerProperties.set(`${layer}:${name}`, value);
  }

  setPaintProperty(layer: string, name: string, value: unknown) {
    this.layerProperties.set(`${layer}:${name}`, value);
  }

  project([lon, lat]: [number, number]) {
    return { x: lon * 10, y: -lat * 10 };
  }

  zoom = 6;
  pitch = 0;
  terrain: { source: string; exaggeration: number } | null = null;
  readonly flights: { zoom?: number; pitch?: number }[] = [];

  getZoom() {
    return this.zoom;
  }

  getPitch() {
    return this.pitch;
  }

  getTerrain() {
    return this.terrain;
  }

  setTerrain(terrain: { source: string; exaggeration: number } | null) {
    this.terrain = terrain;
  }

  // What jumpTo was given: the camera moving with no flight.
  readonly jumps: { zoom?: number; pitch?: number }[] = [];

  flyTo(options: { zoom?: number; pitch?: number }) {
    this.flights.push(options);
    this.zoom = options.zoom ?? this.zoom;
    this.pitch = options.pitch ?? this.pitch;
    this.emit("zoomend", {});
    // A real flight ends later, after the caller has had the chance to listen for it.
    queueMicrotask(() => this.emit("moveend", {}));
  }

  jumpTo(options: { zoom?: number; pitch?: number }) {
    this.jumps.push(options);
    this.zoom = options.zoom ?? this.zoom;
    this.pitch = options.pitch ?? this.pitch;
  }

  getBounds() {
    return { getWest: () => 78, getSouth: () => 25, getEast: () => 90, getNorth: () => 31 };
  }

  fitBounds(bounds: unknown) {
    this.fitted.push(bounds);
  }

  easeTo(options: { pitch?: number; duration?: number }) {
    this.eased.push(options);
    this.pitch = options.pitch ?? this.pitch;
  }

  remove() {
    this.container.replaceChildren();
  }
}

class FakeLngLatBounds {
  extend() {
    return this;
  }
}

class FakeMarker {
  readonly element: HTMLElement;
  readonly draggable: boolean;
  lngLat: [number, number] = [0, 0];
  private readonly handlers = new Map<string, Handler[]>();

  constructor(options: { element: HTMLElement; draggable?: boolean }) {
    this.element = options.element;
    this.draggable = options.draggable ?? false;
    markers.push(this);
  }

  setLngLat(lngLat: [number, number]) {
    this.lngLat = lngLat;
    return this;
  }

  getLngLat() {
    return { lng: this.lngLat[0], lat: this.lngLat[1] };
  }

  on(type: string, handler: Handler) {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
    return this;
  }

  emit(type: string) {
    for (const handler of this.handlers.get(type) ?? []) handler({});
  }

  addTo(map: FakeMap) {
    map.container.appendChild(this.element);
    return this;
  }

  remove() {
    this.element.remove();
    markers.splice(markers.indexOf(this), 1);
    return this;
  }
}

const maps: FakeMap[] = [];
const markers: FakeMarker[] = [];

export const protocols: string[] = [];

export function addProtocol(name: string) {
  protocols.push(name);
}

export { FakeLngLatBounds as LngLatBounds, FakeMap as Map, FakeMarker as Marker };

export function lastMap(): FakeMap {
  const map = maps.at(-1);
  if (!map) throw new Error("the page has not created a map");
  return map;
}

export function forgetMaps() {
  maps.length = 0;
}

// What a source holds now: its first data, or what the app has set since.
export function sourceData(name: string): GeoJSON.FeatureCollection {
  const data = lastMap().sources.get(name)?.data;
  if (typeof data !== "object") throw new Error(`source ${name} holds no GeoJSON data`);
  return data as GeoJSON.FeatureCollection;
}

// Every address the map was told to fetch from, so a test can see where it would go.
export function addressesTheMapWouldFetch(): string[] {
  const map = lastMap();
  const addresses = [...map.sources.values()].flatMap((spec) => [
    ...(typeof spec.data === "string" ? [spec.data] : []),
    // A custom protocol's address wraps the real one; the real one is where the request goes.
    ...(spec.tiles ?? []).map((tile) => tile.replace(/^[a-z-]+:\/\/(?=https?:)/, "")),
  ]);
  return [map.glyphs, map.sprite, ...addresses].filter(
    (address): address is string => address !== undefined,
  );
}

export function tapMap(lat: number, lon: number) {
  lastMap().emit("click", { lngLat: { lat, lng: lon } });
}

// Where the marker that holds `inside` sits now, as [lat, lon].
export function markerAt(inside: HTMLElement): [number, number] {
  const marker = markers.find((each) => each.element.contains(inside));
  if (!marker) throw new Error("no marker holds that element");
  return [marker.lngLat[1], marker.lngLat[0]];
}

// Drops the draggable marker that holds `inside` at a new spot, as a user's drag would.
export function dragMarker(inside: HTMLElement, lat: number, lon: number) {
  const marker = markers.find((each) => each.element.contains(inside));
  if (!marker) throw new Error("no marker holds that element");
  if (!marker.draggable) throw new Error("that marker is not draggable");
  marker.setLngLat([lon, lat]);
  marker.emit("dragend");
}
