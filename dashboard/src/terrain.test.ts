import { tintPixels, terrariumHeight, type Rgb } from "./heightBands";
import { MIN_PANNING_FPS, createFrameWatch } from "./terrain";

const BANDS: Rgb[] = [
  [10, 0, 0],
  [20, 0, 0],
  [30, 0, 0],
];

// A Terrarium pixel for a height in metres (the inverse of `terrariumHeight`).
function pixel(metres: number): number[] {
  const shifted = metres + 32768;
  const red = Math.floor(shifted / 256);
  const green = Math.floor(shifted - red * 256);
  return [red, green, 0, 255];
}

describe("height bands", () => {
  it("reads a Terrarium pixel as metres", () => {
    const [red, green, blue] = pixel(2750);
    expect(terrariumHeight(red, green, blue)).toBe(2750);
  });

  it("leaves the valley floor clear and lightens the ground in three steps", () => {
    const tinted = tintPixels(
      new Uint8ClampedArray([...pixel(900), ...pixel(2100), ...pixel(3600), ...pixel(6000)]),
      BANDS,
    );
    const alphas = [3, 7, 11, 15].map((at) => tinted[at]);
    const reds = [0, 4, 8, 12].map((at) => tinted[at]);
    expect(alphas[0]).toBe(0);
    expect(alphas.slice(1).every((alpha) => alpha > 0)).toBe(true);
    expect(reds.slice(1)).toEqual([10, 20, 30]);
  });
});

describe("the frame-rate watch", () => {
  function watchAt(frameMs: number) {
    let clock = 0;
    const onSlow = vi.fn();
    const watch = createFrameWatch(onSlow, () => clock);
    for (let frame = 0; frame < 40; frame++) {
      clock += frameMs;
      watch.frame();
    }
    return onSlow;
  }

  it("stays quiet at 60 frames per second", () => {
    expect(watchAt(1000 / 60)).not.toHaveBeenCalled();
  });

  it("fires once when panning drops under the threshold", () => {
    expect(watchAt(1000 / (MIN_PANNING_FPS - 4))).toHaveBeenCalledTimes(1);
  });

  it("does not count the pause between two moves as a slow frame", () => {
    let clock = 0;
    const onSlow = vi.fn();
    const watch = createFrameWatch(onSlow, () => clock);
    for (let frame = 0; frame < 20; frame++) {
      clock += 16;
      watch.frame();
    }
    clock += 60_000;
    watch.restart();
    for (let frame = 0; frame < 40; frame++) {
      clock += 16;
      watch.frame();
    }
    expect(onSlow).not.toHaveBeenCalled();
  });
});
