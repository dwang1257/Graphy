import { withDefaults, type Settings } from "./schema.js";

export interface ImageAssets {
  light: { backgroundImage: string | null; nodeBackgroundImage: string | null };
  dark: { backgroundImage: string | null; nodeBackgroundImage: string | null };
}

const EMPTY_IMAGES: ImageAssets = {
  light: { backgroundImage: null, nodeBackgroundImage: null },
  dark: { backgroundImage: null, nodeBackgroundImage: null },
};

function asImage(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function paletteImages(raw: unknown): ImageAssets["light"] {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    backgroundImage: asImage(o.backgroundImage),
    nodeBackgroundImage: asImage(o.nodeBackgroundImage),
  };
}

export function stripImages(settings: Settings): Settings {
  return mergeImages(settings, EMPTY_IMAGES);
}

export function extractImages(settings: Settings): ImageAssets {
  return {
    light: {
      backgroundImage: settings.light.backgroundImage,
      nodeBackgroundImage: settings.light.nodeBackgroundImage,
    },
    dark: {
      backgroundImage: settings.dark.backgroundImage,
      nodeBackgroundImage: settings.dark.nodeBackgroundImage,
    },
  };
}

export function mergeImages(settings: Settings, images: ImageAssets): Settings {
  return {
    ...settings,
    light: { ...settings.light, ...images.light },
    dark: { ...settings.dark, ...images.dark },
  };
}

/** Coerce a local-storage image bag; only non-empty strings are kept. */
export function sanitizeImageAssets(stored: unknown): ImageAssets {
  if (!stored || typeof stored !== "object") {
    return { light: { ...EMPTY_IMAGES.light }, dark: { ...EMPTY_IMAGES.dark } };
  }
  const raw = stored as Record<string, unknown>;
  return {
    light: paletteImages(raw.light),
    dark: paletteImages(raw.dark),
  };
}

export function settingsFromStores(
  syncStored: unknown,
  localImages: unknown,
  hasLocalImages: boolean,
): Settings {
  const compact = withDefaults(syncStored);
  if (!hasLocalImages) return compact;
  return mergeImages(compact, sanitizeImageAssets(localImages));
}
