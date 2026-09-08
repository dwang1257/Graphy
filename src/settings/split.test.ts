import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, type Settings } from "./schema.js";
import {
  extractImages,
  mergeImages,
  sanitizeImageAssets,
  settingsFromStores,
  stripImages,
  type ImageAssets,
} from "./split.js";

const IMAGES: ImageAssets = {
  light: { backgroundImage: "data:light-bg", nodeBackgroundImage: "data:light-node" },
  dark: { backgroundImage: "data:dark-bg", nodeBackgroundImage: "data:dark-node" },
};

function settingsWithImages(overrides: Partial<Settings> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
    light: { ...DEFAULT_SETTINGS.light, ...IMAGES.light, ...(overrides.light ?? {}) },
    dark: { ...DEFAULT_SETTINGS.dark, ...IMAGES.dark, ...(overrides.dark ?? {}) },
  };
}

describe("stripImages", () => {
  it("nulls all four image fields and keeps a custom color / mode", () => {
    const settings = settingsWithImages({
      mode: "light",
      light: { ...DEFAULT_SETTINGS.light, ...IMAGES.light, nodeFill: "#ff00aa" },
    });

    const stripped = stripImages(settings);

    expect(stripped.light.backgroundImage).toBeNull();
    expect(stripped.light.nodeBackgroundImage).toBeNull();
    expect(stripped.dark.backgroundImage).toBeNull();
    expect(stripped.dark.nodeBackgroundImage).toBeNull();
    expect(stripped.mode).toBe("light");
    expect(stripped.light.nodeFill).toBe("#ff00aa");
  });

  it("does not mutate the input object", () => {
    const settings = settingsWithImages();
    const before = structuredClone(settings);

    stripImages(settings);

    expect(settings).toEqual(before);
  });
});

describe("extractImages", () => {
  it("returns the four image fields", () => {
    expect(extractImages(settingsWithImages())).toEqual(IMAGES);
  });
});

describe("mergeImages", () => {
  it("overlays images onto colors without mutating inputs", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      light: { ...DEFAULT_SETTINGS.light, nodeFill: "#abcdef" },
    };
    const settingsBefore = structuredClone(settings);
    const imagesBefore = structuredClone(IMAGES);

    const merged = mergeImages(settings, IMAGES);

    expect(merged.light.backgroundImage).toBe(IMAGES.light.backgroundImage);
    expect(merged.light.nodeBackgroundImage).toBe(IMAGES.light.nodeBackgroundImage);
    expect(merged.dark.backgroundImage).toBe(IMAGES.dark.backgroundImage);
    expect(merged.dark.nodeBackgroundImage).toBe(IMAGES.dark.nodeBackgroundImage);
    expect(merged.light.nodeFill).toBe("#abcdef");
    expect(settings).toEqual(settingsBefore);
    expect(IMAGES).toEqual(imagesBefore);
  });
});

describe("sanitizeImageAssets", () => {
  it("rejects empty strings / non-strings and fills missing keys with null", () => {
    expect(sanitizeImageAssets(null)).toEqual({
      light: { backgroundImage: null, nodeBackgroundImage: null },
      dark: { backgroundImage: null, nodeBackgroundImage: null },
    });
    expect(
      sanitizeImageAssets({
        light: { backgroundImage: "", nodeBackgroundImage: 12 },
        dark: { backgroundImage: "data:ok" },
      }),
    ).toEqual({
      light: { backgroundImage: null, nodeBackgroundImage: null },
      dark: { backgroundImage: "data:ok", nodeBackgroundImage: null },
    });
  });
});

describe("settingsFromStores", () => {
  it("without a local key keeps legacy sync images", () => {
    const syncStored = settingsWithImages({ mode: "light" });

    const loaded = settingsFromStores(syncStored, undefined, false);

    expect(loaded.light.backgroundImage).toBe(IMAGES.light.backgroundImage);
    expect(loaded.light.nodeBackgroundImage).toBe(IMAGES.light.nodeBackgroundImage);
    expect(loaded.dark.backgroundImage).toBe(IMAGES.dark.backgroundImage);
    expect(loaded.dark.nodeBackgroundImage).toBe(IMAGES.dark.nodeBackgroundImage);
    expect(loaded.mode).toBe("light");
  });

  it("with a local key uses local images (and a local null clears a legacy sync image)", () => {
    const syncStored = settingsWithImages();
    const localImages = {
      light: { backgroundImage: "data:local-bg", nodeBackgroundImage: null },
      dark: { backgroundImage: "data:local-dark", nodeBackgroundImage: "data:local-dark-node" },
    };

    const loaded = settingsFromStores(syncStored, localImages, true);

    expect(loaded.light.backgroundImage).toBe("data:local-bg");
    expect(loaded.light.nodeBackgroundImage).toBeNull();
    expect(loaded.dark.backgroundImage).toBe("data:local-dark");
    expect(loaded.dark.nodeBackgroundImage).toBe("data:local-dark-node");
  });
});
