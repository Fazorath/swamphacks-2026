import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const tileLayerProps = vi.hoisted(() => ({ latest: null as null | Record<string, unknown> }));

vi.mock("react-leaflet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-leaflet")>()),
  TileLayer: (props: Record<string, unknown>) => {
    tileLayerProps.latest = props;
    return null;
  },
}));

import { NodeMap } from "./NodeMap";

function renderMap(packTileMaxZoom: number | null) {
  render(
    <NodeMap
      nodes={[]}
      packTileMaxZoom={packTileMaxZoom}
      selectedId={null}
      onSelect={() => {}}
      stormSignal={null}
      home={null}
      shelters={[]}
      openShelterIds={[]}
      floodProne={null}
      shelter={null}
      route={null}
      draftHome={null}
      picking={false}
      onPickHome={() => {}}
      onDonePicking={() => {}}
      blockedRoadLines={[]}
      canBlockRoads={false}
      blocking={false}
      onToggleBlocking={() => {}}
      onTapRoad={() => {}}
    />,
  );
  return tileLayerProps.latest!;
}

describe("NodeMap tiles", () => {
  it("reads tiles from the Cache Pack when the Node has one", () => {
    expect(renderMap(14).url).toBe("/api/cache-pack/files/tiles/{z}/{x}/{y}.png");
  });

  it("stretches the pack's deepest tiles instead of asking for ones it lacks", () => {
    expect(renderMap(14).maxNativeZoom).toBe(14);
  });

  it("falls back to online tiles without a pack", () => {
    expect(renderMap(null).url).toBe("/api/tiles/{z}/{x}/{y}.png");
  });

  it("always shows the data credit", () => {
    for (const maxZoom of [14, null]) {
      expect(renderMap(maxZoom).attribution).toMatch(/OpenStreetMap.*CARTO/);
    }
  });
});
