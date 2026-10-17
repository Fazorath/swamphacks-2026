import { describe, expect, it } from "vitest";

import { onlineUrlForMissingPackTile, tileUrlTemplate } from "./mapTiles";

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
