import { renderHook } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { NodeOnMap } from "./nodesOnMap";
import { PAGER_RADIUS_KM, highNodesNearHome, playPager } from "./pager";
import { usePager } from "./usePager";

vi.mock("./pager", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./pager")>()),
  armPagerSound: () => () => {},
  playPager: vi.fn(),
}));

const HOME = { lat: 28.1654, lon: 85.3398 };

function node(id: string, position: [number, number], over: Partial<NodeOnMap> = {}): NodeOnMap {
  return {
    id,
    isThisNode: false,
    label: id,
    position,
    waterLevelCm: null,
    simulated: false,
    stale: false,
    registered: true,
    level: null,
    ageSeconds: 1,
    measurements: [],
    ...over,
  };
}

const NEAR = node("near", [28.17, 85.34]);
const UPSTREAM = node("upstream", [28.35, 85.45]);
// About 130 km from the Syabrubesi home, well past the radius.
const OUT_OF_RADIUS = node("far-south", [27.0, 85.3]);

const high = (each: NodeOnMap) => ({ ...each, level: "high" as const });

beforeEach(() => vi.mocked(playPager).mockClear());

describe("highNodesNearHome", () => {
  test("lists Nodes with a High warning inside the radius, nearest first", () => {
    const found = highNodesNearHome([high(UPSTREAM), high(NEAR), NEAR], HOME);
    expect(found.map(({ id }) => id)).toEqual(["near", "upstream"]);
    expect(found[1].km).toBeLessThanOrEqual(PAGER_RADIUS_KM);
  });

  test("leaves out an Elevated Node and a High Node beyond the radius", () => {
    const elevated = { ...NEAR, level: "elevated" as const };
    expect(highNodesNearHome([elevated, high(OUT_OF_RADIUS)], HOME)).toEqual([]);
  });
});

describe("usePager", () => {
  test("pages when a Node in the radius newly reaches High", () => {
    const { result, rerender } = renderHook(({ nodes }) => usePager(nodes, HOME), {
      initialProps: { nodes: [NEAR, UPSTREAM] },
    });
    expect(result.current.alert).toBeNull();
    rerender({ nodes: [NEAR, high(UPSTREAM)] });
    expect(result.current.alert).toMatchObject({ label: "upstream" });
    expect(playPager).toHaveBeenCalledTimes(1);
  });

  test("a Node already High when the page opens does not page", () => {
    const { result } = renderHook(() => usePager([high(NEAR)], HOME));
    expect(result.current.alert).toBeNull();
    expect(playPager).not.toHaveBeenCalled();
  });

  test("a High Node beyond the radius does not page", () => {
    const { result, rerender } = renderHook(({ nodes }) => usePager(nodes, HOME), {
      initialProps: { nodes: [OUT_OF_RADIUS] },
    });
    rerender({ nodes: [high(OUT_OF_RADIUS)] });
    expect(result.current.alert).toBeNull();
  });

  test("a Node that stays High pages once, not on every update", () => {
    const { rerender } = renderHook(({ nodes }) => usePager(nodes, HOME), {
      initialProps: { nodes: [NEAR] },
    });
    rerender({ nodes: [high(NEAR)] });
    rerender({ nodes: [high(NEAR)] });
    rerender({ nodes: [{ ...high(NEAR), ageSeconds: 3 }] });
    expect(playPager).toHaveBeenCalledTimes(1);
  });

  test("with no saved home it stays silent", () => {
    const { result, rerender } = renderHook(({ nodes }) => usePager(nodes, null), {
      initialProps: { nodes: [NEAR] },
    });
    rerender({ nodes: [high(NEAR)] });
    expect(result.current.alert).toBeNull();
  });

  test("dismiss clears the alert, and the same Node reaching High again pages again", () => {
    const { result, rerender } = renderHook(({ nodes }) => usePager(nodes, HOME), {
      initialProps: { nodes: [NEAR] },
    });
    rerender({ nodes: [high(NEAR)] });
    act(() => result.current.dismiss());
    expect(result.current.alert).toBeNull();
    rerender({ nodes: [NEAR] });
    rerender({ nodes: [high(NEAR)] });
    expect(result.current.alert).toMatchObject({ label: "near" });
    expect(playPager).toHaveBeenCalledTimes(2);
  });
});
