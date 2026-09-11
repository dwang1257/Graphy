import { describe, expect, it } from "vitest";
import {
  contrastInk,
  contrastInkFromCss,
  DARK_INK,
  haloFromInk,
  LIGHT_INK,
  imageToneFromInk,
  medianLuminance,
  paintTone,
  stageOverlayInk,
} from "./imageInk.js";

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

  it("classifies default palette fills so visited can dim or lift them", () => {
    expect(paintTone("#eef2ff")).toBe("light");
    expect(paintTone("#f8fafc")).toBe("light");
    expect(paintTone("#312e81")).toBe("dark");
    expect(paintTone("#4f46e5")).toBe("dark");
  });

  it("uses the photo tone for pattern fills instead of treating url() as a color", () => {
    expect(paintTone("url(#graphy-node-bg)", "light")).toBe("light");
    expect(paintTone("url(#graphy-node-bg)", "dark")).toBe("dark");
    expect(paintTone("url(#graphy-node-bg)")).toBe("dark");
  });

  it("derives photo tone from contrast ink", () => {
    expect(imageToneFromInk(DARK_INK)).toBe("light");
    expect(imageToneFromInk(LIGHT_INK)).toBe("dark");
  });

  it("ignores a bright highlight when most pixels are dark", () => {
    const pixels = [
      ...Array.from({ length: 9 }, () => [16, 16, 16] as [number, number, number]),
      [255, 255, 255] as [number, number, number],
    ];
    expect(contrastInk(medianLuminance(rgba(...pixels)))).toBe(LIGHT_INK);
  });
});

describe("contrast ink from CSS fills", () => {
  it("picks dark ink on a light CSS fill so numbers stay readable", () => {
    expect(contrastInkFromCss("#eef2ff")).toBe(DARK_INK);
    expect(contrastInkFromCss("#ffffff")).toBe(DARK_INK);
    expect(contrastInkFromCss("rgb(248, 250, 252)")).toBe(DARK_INK);
  });

  it("picks light ink on a dark CSS fill so numbers stay readable", () => {
    expect(contrastInkFromCss("#312e81")).toBe(LIGHT_INK);
    expect(contrastInkFromCss("#111827")).toBe(LIGHT_INK);
    expect(contrastInkFromCss("rgb(79, 70, 229)")).toBe(LIGHT_INK);
  });
});

describe("stage overlay ink and halo", () => {
  it("uses dark letters and a light halo on a solid light fill", () => {
    expect(stageOverlayInk("#ffffff")).toEqual({ ink: DARK_INK, halo: LIGHT_INK });
    expect(stageOverlayInk("#eef2ff")).toEqual({ ink: DARK_INK, halo: LIGHT_INK });
    expect(haloFromInk(DARK_INK)).toBe(LIGHT_INK);
  });

  it("uses light letters and a dark halo on a solid dark fill", () => {
    expect(stageOverlayInk("#1a1a1a")).toEqual({ ink: LIGHT_INK, halo: DARK_INK });
    expect(stageOverlayInk("#111827")).toEqual({ ink: LIGHT_INK, halo: DARK_INK });
    expect(haloFromInk(LIGHT_INK)).toBe(DARK_INK);
  });

  it("uses photo ink instead of the fallback fill color", () => {
    expect(stageOverlayInk("#ffffff", LIGHT_INK)).toEqual({ ink: LIGHT_INK, halo: DARK_INK });
    expect(stageOverlayInk("#1a1a1a", DARK_INK)).toEqual({ ink: DARK_INK, halo: LIGHT_INK });
    expect(stageOverlayInk("#ffffff", null)).toEqual({ ink: DARK_INK, halo: LIGHT_INK });
  });
});
