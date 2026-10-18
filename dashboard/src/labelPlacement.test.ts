import { placeLabels, type MapLabel } from "./labelPlacement";

const label = (id: string, rank: number, x = 100, y = 100, must = false): MapLabel => ({
  id,
  x,
  y,
  width: 80,
  height: 20,
  rank,
  must,
});

it("moves a label that would sit on a better one to a free side", () => {
  const placement = placeLabels([label("gompa", 3), label("Syabrubesi", 1)]);
  expect(placement.get("Syabrubesi")).toBe("right");
  expect(placement.get("gompa")).toBe("left");
});

it("hides the worse label when every side is taken", () => {
  const crowd = [label("a", 1), label("b", 2), label("c", 3), label("d", 4), label("e", 5)];
  const placement = placeLabels(crowd);
  expect([...placement.values()].filter((side) => side === null)).toHaveLength(1);
  expect(placement.get("e")).toBeNull();
});

it("never hides a key place or the chosen Shelter, even when the spot is crowded", () => {
  const crowd = [
    label("fleet", 1),
    label("fleet 2", 1),
    label("fleet 3", 1),
    label("fleet 4", 1),
    label("Syabrubesi", 0, 100, 100, true),
    label("chosen", 0, 100, 100, true),
  ];
  const placement = placeLabels(crowd);
  expect(placement.get("Syabrubesi")).not.toBeNull();
  expect(placement.get("chosen")).not.toBeNull();
});

it("leaves labels that do not collide on the right", () => {
  const placement = placeLabels([label("a", 1, 0, 0), label("b", 2, 0, 200)]);
  expect([...placement.values()]).toEqual(["right", "right"]);
});

it("keeps a label's side until something sits on it", () => {
  const first = placeLabels([label("a", 1), label("b", 2)]);
  expect(first.get("b")).toBe("left");
  const panned = placeLabels([label("a", 1, 100, 100), label("b", 2, 100, 112)], first);
  expect(panned.get("b")).toBe("left");
  const apart = placeLabels([label("a", 1, 100, 100), label("b", 2, 100, 300)], first);
  expect(apart.get("b")).toBe("left");
});

it("does not decide by the order of the list", () => {
  const forward = placeLabels([label("a", 1), label("b", 2)]);
  const backward = placeLabels([label("b", 2), label("a", 1)]);
  expect(backward).toEqual(forward);
});
