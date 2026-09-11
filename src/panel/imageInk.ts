export const DARK_INK = "#1e1b4b";
export const LIGHT_INK = "#f8fafc";
export const NODE_OUTLINE = "#000000";
export const IMAGE_TONE_ATTR = "data-graphy-image-tone";

export type PaintTone = "light" | "dark";

const LIGHT_THRESHOLD = 0.55;

function channelToLinear(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b);
}

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

export function toneFromLuminance(luminance: number): PaintTone {
  return luminance > LIGHT_THRESHOLD ? "light" : "dark";
}

export function contrastInk(luminance: number): string {
  return toneFromLuminance(luminance) === "light" ? DARK_INK : LIGHT_INK;
}

export function contrastInkFromCss(color: string): string {
  const rgb = rgbFromCssColor(color);
  return rgb ? contrastInk(relativeLuminance(...rgb)) : DARK_INK;
}

export function haloFromInk(ink: string): string {
  return ink === DARK_INK ? LIGHT_INK : DARK_INK;
}

export function stageOverlayInk(background: string, imageInk?: string | null): { ink: string; halo: string } {
  const ink = imageInk ?? contrastInkFromCss(background);
  return { ink, halo: haloFromInk(ink) };
}

export function imageToneFromInk(ink: string): PaintTone {
  return ink === DARK_INK ? "light" : "dark";
}

export function rgbFromCssColor(value: string): [number, number, number] | null {
  const s = value.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3,8})$/.exec(s)?.[1];
  if (hex && (hex.length === 3 || hex.length === 4 || hex.length === 6 || hex.length === 8)) {
    const packed = hex.length <= 4 ? `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}` : hex;
    return [
      parseInt(packed.slice(0, 2), 16),
      parseInt(packed.slice(2, 4), 16),
      parseInt(packed.slice(4, 6), 16),
    ];
  }
  const rgb = /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/.exec(s);
  return rgb ? [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])] : null;
}

export function paintTone(fill: string | null | undefined, imageTone?: PaintTone | null): PaintTone {
  if (fill && /^\s*url\(/i.test(fill)) return imageTone === "light" ? "light" : "dark";
  const rgb = fill ? rgbFromCssColor(fill) : null;
  return rgb ? toneFromLuminance(relativeLuminance(...rgb)) : (imageTone ?? "light");
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read node background image"));
    image.src = url;
  });
}

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
