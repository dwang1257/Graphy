import type { Settings } from "../settings/schema.js";

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGE_DIMENSION = 4096;

export type ImageSlot = "backgroundImage" | "nodeBackgroundImage";

export interface ImageBudget {
  dimension: number;
  chars: number;
}

export const IMAGE_BUDGETS: Record<ImageSlot, ImageBudget> = {
  backgroundImage: { dimension: 2048, chars: 1_500_000 },
  nodeBackgroundImage: { dimension: 512, chars: 200_000 },
};

const QUALITIES = [0.85, 0.7, 0.55];
const MIN_DIMENSION = 64;

interface ImageDimensions {
  width: number;
  height: number;
}

export interface ImageUploadPlatform {
  decode: (file: Blob) => Promise<ImageDimensions>;
  encode: (file: Blob, size: ImageDimensions, quality: number) => Promise<string>;
  readAsDataUrl: (file: Blob) => Promise<string>;
  toBlob: (dataUrl: string) => Promise<Blob>;
}

const uploadError = "Graphy could not read that image. Try another image file.";

function readBlob(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error(uploadError));
      }
    };
    reader.onerror = () => reject(new Error(uploadError));
    reader.onabort = () => reject(new Error(uploadError));
    reader.readAsDataURL(file);
  });
}

const browserPlatform: ImageUploadPlatform = {
  async decode(file): Promise<ImageDimensions> {
    const bitmap = await createImageBitmap(file);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  },
  async encode(file, size, quality): Promise<string> {
    const bitmap = await createImageBitmap(file, {
      resizeWidth: size.width,
      resizeHeight: size.height,
      resizeQuality: "high",
    });
    try {
      const canvas = new OffscreenCanvas(size.width, size.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error(uploadError);
      ctx.drawImage(bitmap, 0, 0);
      return await readBlob(await canvas.convertToBlob({ type: "image/webp", quality }));
    } finally {
      bitmap.close();
    }
  },
  readAsDataUrl: readBlob,
  async toBlob(dataUrl): Promise<Blob> {
    return (await fetch(dataUrl)).blob();
  },
};

function scaledTo(dimensions: ImageDimensions, limit: number): ImageDimensions {
  const scale = Math.min(1, limit / Math.max(dimensions.width, dimensions.height));
  return {
    width: Math.max(1, Math.round(dimensions.width * scale)),
    height: Math.max(1, Math.round(dimensions.height * scale)),
  };
}

async function fitImage(
  file: Blob,
  dimensions: ImageDimensions,
  budget: ImageBudget,
  platform: ImageUploadPlatform,
): Promise<string> {
  const withinDimension = Math.max(dimensions.width, dimensions.height) <= budget.dimension;
  if (withinDimension && Math.ceil(file.size / 3) * 4 < budget.chars) {
    const original = await platform.readAsDataUrl(file);
    if (original.length <= budget.chars) return original;
  }

  let size = scaledTo(dimensions, budget.dimension);
  for (;;) {
    for (const quality of QUALITIES) {
      const encoded = await platform.encode(file, size, quality);
      if (encoded.length <= budget.chars) return encoded;
    }
    const longest = Math.max(size.width, size.height);
    if (longest <= MIN_DIMENSION) throw new Error(uploadError);
    size = scaledTo(size, Math.max(MIN_DIMENSION, Math.floor(longest / 2)));
  }
}

export async function readImageDataUrl(
  file: Pick<File, "size" | "type">,
  slot: ImageSlot,
  platform: ImageUploadPlatform = browserPlatform,
): Promise<string> {
  if (!file.type.toLowerCase().startsWith("image/")) {
    throw new Error("Choose an image file.");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 4 MB or smaller.");
  }

  let dimensions: ImageDimensions;
  try {
    dimensions = await platform.decode(file as Blob);
  } catch {
    throw new Error(uploadError);
  }
  if (
    dimensions.width > MAX_IMAGE_DIMENSION ||
    dimensions.height > MAX_IMAGE_DIMENSION ||
    dimensions.width <= 0 ||
    dimensions.height <= 0
  ) {
    throw new Error("Image dimensions must be 4096 × 4096 pixels or smaller.");
  }

  try {
    return await fitImage(file as Blob, dimensions, IMAGE_BUDGETS[slot], platform);
  } catch {
    throw new Error(uploadError);
  }
}

export async function compactImageDataUrl(
  dataUrl: string,
  slot: ImageSlot,
  platform: ImageUploadPlatform = browserPlatform,
): Promise<string> {
  const budget = IMAGE_BUDGETS[slot];
  if (dataUrl.length <= budget.chars) return dataUrl;
  const blob = await platform.toBlob(dataUrl);
  return fitImage(blob, await platform.decode(blob), budget, platform);
}

export async function compactSettingsImages(
  settings: Settings,
  platform: ImageUploadPlatform = browserPlatform,
): Promise<Settings> {
  let next = settings;
  for (const mode of ["light", "dark"] as const) {
    for (const slot of ["backgroundImage", "nodeBackgroundImage"] as const) {
      const url = next[mode][slot];
      if (!url) continue;
      let compacted: string;
      try {
        compacted = await compactImageDataUrl(url, slot, platform);
      } catch {
        continue;
      }
      if (compacted === url) continue;
      next = { ...next, [mode]: { ...next[mode], [slot]: compacted } };
    }
  }
  return next;
}
