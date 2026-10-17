import { describe, expect, it } from "vitest";

import { deepestTileZoom, onlineUrlForMissingPackTile, tileUrlTemplate } from "./mapTiles";

describe("deepest tile zoom", () => {
  it("is the highest zoom among the pack's tiles", () => {
    expect(
      deepestTileZoom({
        "shelters.json": "x",
        "tiles/10/754/427.png": "x",
        "tiles/14/12072/6866.png": "x",
        "tiles/9/377/213.png": "x",
      }),
    ).toBe(14);
  });

  it("is null for a pack without tiles", () => {
    expect(deepestTileZoom({ "shelters.json": "x" })).toBeNull();
  });
});

describe("map tile source", () => {
  it("reads tiles from the Cache Pack when the Node has one", () => {
    expect(tileUrlTemplate(true)).toBe("/api/cache-pack/files/tiles/{z}/{x}/{y}.png");
  });

  it("reads online tiles when the Node has no pack", () => {
    expect(tileUrlTemplate(false)).toBe("/api/tiles/{z}/{x}/{y}.png");
  });

  it("asks online for a tile the pack lacks", () => {
    expect(onlineUrlForMissingPackTile("http://node/api/cache-pack/files/tiles/17/3/4.png")).toBe(
      "/api/tiles/17/3/4.png",
    );
  });

  it("does not retry a tile that was already online", () => {
    expect(onlineUrlForMissingPackTile("http://node/api/tiles/17/3/4.png")).toBeNull();
  });
});
