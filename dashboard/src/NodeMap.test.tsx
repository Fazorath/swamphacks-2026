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

function renderMap(packAvailable: boolean) {
  render(
    <NodeMap
      nodes={[]}
      packAvailable={packAvailable}
      selectedId={null}
      onSelect={() => {}}
      stormSignal={null}
      home={null}
      shelter={null}
      route={null}
      draftHome={null}
      picking={false}
      onPickHome={() => {}}
      onDonePicking={() => {}}
    />,
  );
  return tileLayerProps.latest!;
}

describe("NodeMap tiles", () => {
  it("reads tiles from the Cache Pack when the Node has one", () => {
    expect(renderMap(true).url).toBe("/api/cache-pack/files/tiles/{z}/{x}/{y}.png");
  });

  it("falls back to online tiles without a pack", () => {
    expect(renderMap(false).url).toBe("/api/tiles/{z}/{x}/{y}.png");
  });

  it("always shows the data credit", () => {
    for (const packAvailable of [true, false]) {
      expect(renderMap(packAvailable).attribution).toMatch(/OpenStreetMap.*CARTO/);
    }
  });
});
