// The parts of a pack manifest that say it holds a basemap and terrain; spread into a fake manifest.
export const BASEMAP_MANIFEST_PARTS = {
  terrain: { encoding: "terrarium", approximate: true, zooms: [9, 12] },
  sources: [
    { layer: "basemap", credit: "© OpenStreetMap contributors", checked: "2026-10-18" },
    { layer: "terrain", credit: "Terrain: Mapzen (Terrarium tiles)", checked: "2026-10-18" },
  ],
  files: {
    "basemap/water.geojson": "0",
    "basemap/waterways.geojson": "0",
    "basemap/coastline.geojson": "0",
    "basemap/roads.geojson": "0",
    "basemap/places.geojson": "0",
  },
};
