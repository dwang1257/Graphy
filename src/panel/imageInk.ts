/** Theme ink on light paper — used when the photo itself is light. */
export const DARK_INK = "#1e1b4b";
/** Near-paper ink — used when the photo itself is dark. */
export const LIGHT_INK = "#f8fafc";
export const NODE_OUTLINE = "#000000";
/** Set on the SVG root when a node-background photo's luminance is known. */
export const IMAGE_TONE_ATTR = "data-graphy-image-tone";

export type PaintTone = "light" | "dark";

/** Relative luminance above this counts as a light image. */
const LIGHT_THRESHOLD = 0.55;

function channelToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** WCAG relative luminance for an sRGB triple. */
export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

/** Median luminance of opaque pixels in an RGBA buffer. */
export function medianLuminance(rgba: Uint8ClampedArray | Uint8Array): number {
  const values: number[] = [];
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if ((rgba[i + 3] ?? 0) === 0) continue;
    values.push(relativeLuminance(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!));
  }
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 1 ? values[mid]! : (values[mid - 1]! + values[mid]!) / 2;
}

export function contrastInk(luminance: number): string {
  return luminance > LIGHT_THRESHOLD ? DARK_INK : LIGHT_INK;
}

export function toneFromLuminance(luminance: number): PaintTone {
  return luminance > LIGHT_THRESHOLD ? "light" : "dark";
}

/** Light photo → dark ink, so the SVG root's tone is the inverse of contrast ink. */
export function imageToneFromInk(ink: string): PaintTone {
  return ink === DARK_INK ? "light" : "dark";
}

/** Parse `#rgb`, `#rrggbb`, and `rgb()` / `rgba()` fills Graphviz and palettes emit. */
export function rgbFromCssColor(value: string): [number, number, number] | null {
  const s = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(s);
  if (hex) {
    const h = hex[1]!;
    if (h.length === 3 || h.length === 4) {
      return [
        parseInt(h[0]! + h[0]!, 16),
        parseInt(h[1]! + h[1]!, 16),
        parseInt(h[2]! + h[2]!, 16),
      ];
    }
    if (h.length === 6 || h.length === 8) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
      ];
    }
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/.exec(s);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  return null;
}

/**
 * Whether a node's current paint is light or dark.
 * Pattern fills (`url(#graphy-node-bg)`) use the photo tone; solid fills use luminance.
 */
export function paintTone(
  fill: string | null | undefined,
  imageTone?: PaintTone | null,
): PaintTone {
  if (fill && /^\s*url\(/i.test(fill)) {
    return imageTone === "light" || imageTone === "dark" ? imageTone : "dark";
  }
  const rgb = fill ? rgbFromCssColor(fill) : null;
  if (!rgb) return imageTone ?? "light";
  return toneFromLuminance(relativeLuminance(...rgb));
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read node background image"));
    image.src = url;
  });
}

/** Downscales the photo and returns its median perceived luminance. */
export async function luminanceFromDataUrl(url: string): Promise<number> {
  const image = await loadImage(url);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  if (!width || !height) return 0;

  const scale = Math.min(1, 64 / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return medianLuminance(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
}

export async function inkFromDataUrl(url: string): Promise<string> {
  return contrastInk(await luminanceFromDataUrl(url));
}
