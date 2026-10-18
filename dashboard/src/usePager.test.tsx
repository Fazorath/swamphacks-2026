import { renderHook } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { NodeOnMap } from "./nodesOnMap";
import { closestNodeToHome, playPager } from "./pager";
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
const FAR = node("far", [27.92, 85.15]);
const ME = node("me", [28.1655, 85.3399], { isThisNode: true });

beforeEach(() => vi.mocked(playPager).mockClear());

describe("closestNodeToHome", () => {
  test("is the nearest Registered Node, never this page's own Node", () => {
    expect(closestNodeToHome([FAR, NEAR, ME], HOME)?.id).toBe("near");
  });

  test("skips an Unverified Node", () => {
    const unverified = node("unverified", [28.1655, 85.3399], { registered: false });
    expect(closestNodeToHome([FAR, unverified], HOME)?.id).toBe("far");
  });

  test("is null with no other Node", () => {
    expect(closestNodeToHome([ME], HOME)).toBeNull();
  });
});

describe("usePager", () => {
  test("pages when the closest Node goes from responding to quiet", () => {
    const { result, rerender } = renderHook(({ nodes }) => usePager(nodes, HOME), {
      initialProps: { nodes: [NEAR, FAR] },
    });
    expect(result.current.alert).toBeNull();
    rerender({ nodes: [{ ...NEAR, stale: true }, FAR] });
    expect(result.current.alert).toEqual({ label: "near" });
    expect(playPager).toHaveBeenCalledTimes(1);
  });

  test("a Node that is already quiet when the page opens does not page", () => {
    const { result } = renderHook(() => usePager([{ ...NEAR, stale: true }, FAR], HOME));
    expect(result.current.alert).toBeNull();
    expect(playPager).not.toHaveBeenCalled();
  });

  test("a farther Node going quiet does not page", () => {
    const { result, rerender } = renderHook(({ nodes }) => usePager(nodes, HOME), {
      initialProps: { nodes: [NEAR, FAR] },
    });
    rerender({ nodes: [NEAR, { ...FAR, stale: true }] });
    expect(result.current.alert).toBeNull();
    expect(playPager).not.toHaveBeenCalled();
  });

  test("with no saved home it stays silent", () => {
    const { result, rerender } = renderHook(({ nodes }) => usePager(nodes, null), {
      initialProps: { nodes: [NEAR] },
    });
    rerender({ nodes: [{ ...NEAR, stale: true }] });
    expect(result.current.alert).toBeNull();
  });

  test("dismiss clears the alert, and a second silence pages again", () => {
    const { result, rerender } = renderHook(({ nodes }) => usePager(nodes, HOME), {
      initialProps: { nodes: [NEAR] },
    });
    rerender({ nodes: [{ ...NEAR, stale: true }] });
    act(() => result.current.dismiss());
    expect(result.current.alert).toBeNull();
    rerender({ nodes: [NEAR] });
    rerender({ nodes: [{ ...NEAR, stale: true }] });
    expect(result.current.alert).toEqual({ label: "near" });
    expect(playPager).toHaveBeenCalledTimes(2);
  });
});
