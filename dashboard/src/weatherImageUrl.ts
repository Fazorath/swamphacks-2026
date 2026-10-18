import type { FieldImage } from "./weatherField";

/** A PNG data address for a painted field, which is what a MapLibre `image` source takes. */
export function weatherImageUrl(image: FieldImage): string {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("This browser cannot draw the weather layer");
  context.putImageData(new ImageData(image.data, image.width, image.height), 0, 0);
  return canvas.toDataURL("image/png");
}
