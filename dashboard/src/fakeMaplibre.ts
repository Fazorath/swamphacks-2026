// A stand-in for maplibre-gl in tests: jsdom has no WebGL, so the real map cannot start. It keeps
// what the app handed to the map (sources, layers, markers) so a test can read it back, and
// setup.ts swaps it in for every test file.
type Handler = (event: unknown) => void;
type GeoJsonData = GeoJSON.GeoJSON | string;

type SourceSpec = { type: string; data?: GeoJsonData; tiles?: string[] };

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
  readonly visibility = new Map<string, string>();

  addImage(id: string) {
    this.images.add(id);
  }

  hasImage(id: string) {
    return this.images.has(id);
  }

  setLayoutProperty(layerId: string, property: string, value: string) {
    if (!this.layerIds.includes(layerId)) throw new Error(`no layer ${layerId}`);
    if (property === "visibility") this.visibility.set(layerId, value);
  }

  getSource(id: string) {
    const spec = this.sources.get(id);
    if (!spec) return undefined;
    return {
      setData: (data: GeoJsonData) => {
        spec.data = data;
      },
    };
  }

  project([lon, lat]: [number, number]) {
    return { x: lon * 10, y: -lat * 10 };
  }

  getZoom() {
    return 6;
  }

  getBounds() {
    return { getWest: () => 78, getSouth: () => 25, getEast: () => 90, getNorth: () => 31 };
  }

  fitBounds(bounds: unknown) {
    this.fitted.push(bounds);
  }

  easeTo(options: unknown) {
    this.eased.push(options);
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
  private readonly element: HTMLElement;
  lngLat: [number, number] = [0, 0];

  constructor(options: { element: HTMLElement }) {
    this.element = options.element;
  }

  setLngLat(lngLat: [number, number]) {
    this.lngLat = lngLat;
    return this;
  }

  addTo(map: FakeMap) {
    map.container.appendChild(this.element);
    return this;
  }

  remove() {
    this.element.remove();
    return this;
  }
}

const maps: FakeMap[] = [];

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
    ...(spec.tiles ?? []),
  ]);
  return [map.glyphs, map.sprite, ...addresses].filter(
    (address): address is string => address !== undefined,
  );
}

export function tapMap(lat: number, lon: number) {
  lastMap().emit("click", { lngLat: { lat, lng: lon } });
}

// Whether a map layer is shown: layers start visible, as in MapLibre.
export function layerShown(layerId: string): boolean {
  return lastMap().visibility.get(layerId) !== "none";
}
