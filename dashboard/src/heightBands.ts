import { addProtocol } from "maplibre-gl";

// The valley walls are shaded in height bands (D-32): the ground lightens in three steps, so high
// ground is literally lighter. MapLibre 4 has no tint-by-height layer, so a custom tile protocol
// reads the pack's own Terrarium elevation tile and paints the bands into a transparent PNG.
export const BAND_PROTOCOL = "elevation-bands";

// Metres above sea level where each band starts. The valley floor (about 600 to 1,900 m) stays
// the plain land colour.
const BAND_STARTS_M = [2000, 3500, 5000];
const BAND_ALPHA = 200;

export type Rgb = [number, number, number];

export function parseHex(colour: string): Rgb | null {
  if (!/^#[0-9a-f]{6}$/i.test(colour)) return null;
  const [red, green, blue] = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16));
  return [red, green, blue];
}

export function terrariumHeight(red: number, green: number, blue: number): number {
  return red * 256 + green + blue / 256 - 32768;
}

// Same size as the elevation tile: each pixel is transparent below the first band, otherwise its
// band's colour.
export function tintPixels(
  elevation: Uint8ClampedArray,
  bandColours: Rgb[],
): Uint8ClampedArray<ArrayBuffer> {
  const tinted = new Uint8ClampedArray(new ArrayBuffer(elevation.length));
  for (let at = 0; at < elevation.length; at += 4) {
    const height = terrariumHeight(elevation[at], elevation[at + 1], elevation[at + 2]);
    const band = BAND_STARTS_M.filter((start) => height >= start).length - 1;
    if (band < 0) continue;
    tinted.set([...bandColours[band], BAND_ALPHA], at);
  }
  return tinted;
}

async function paintBands(url: string, bandColours: Rgb[], signal: AbortSignal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`elevation tile ${url} answered ${response.status}`);
  const bitmap = await createImageBitmap(await response.blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const context = canvas.getContext("2d")!;
  context.drawImage(bitmap, 0, 0);
  const { width, height, data } = context.getImageData(0, 0, bitmap.width, bitmap.height);
  context.putImageData(new ImageData(tintPixels(data, bandColours), width, height), 0, 0);
  const png = await canvas.convertToBlob({ type: "image/png" });
  return png.arrayBuffer();
}

let registered = false;

// A tile address is `elevation-bands://` in front of the pack's own address; a cancelled tile
// aborts its fetch.
export function registerBandProtocol(bandColours: Rgb[]): void {
  if (registered) return;
  registered = true;
  addProtocol(BAND_PROTOCOL, async (request, abort) => ({
    data: await paintBands(
      request.url.slice(`${BAND_PROTOCOL}://`.length),
      bandColours,
      abort.signal,
    ),
  }));
}
