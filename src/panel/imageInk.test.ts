import { describe, expect, it } from "vitest";
import { contrastInk, DARK_INK, LIGHT_INK, medianLuminance } from "./imageInk.js";

function rgba(...pixels: Array<[number, number, number, number?]>): Uint8ClampedArray {
  const data = new Uint8ClampedArray(pixels.length * 4);
  pixels.forEach(([r, g, b, a = 255], i) => {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  });
  return data;
}

describe("contrast ink from image brightness", () => {
  it("uses dark ink on a light image so values stay readable", () => {
    expect(contrastInk(medianLuminance(rgba([255, 255, 255])))).toBe(DARK_INK);
  });

  it("uses light ink on a dark image so values stay readable", () => {
    expect(contrastInk(medianLuminance(rgba([0, 0, 0])))).toBe(LIGHT_INK);
  });

  it("ignores a bright highlight when most pixels are dark", () => {
    const pixels = [
      ...Array.from({ length: 9 }, () => [16, 16, 16] as [number, number, number]),
      [255, 255, 255] as [number, number, number],
    ];
    expect(contrastInk(medianLuminance(rgba(...pixels)))).toBe(LIGHT_INK);
  });
});
