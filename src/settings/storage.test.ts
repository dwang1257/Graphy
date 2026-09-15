import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, type Settings } from "./schema.js";
import { loadSettings, saveSettings } from "./storage.js";

const SYNC_KEY = "graphy.settings";
const IMAGES_KEY = "graphy.images";

const IMAGES = {
  light: { backgroundImage: "data:image/png;base64,light-bg", nodeBackgroundImage: "data:image/png;base64,light-node" },
  dark: { backgroundImage: "data:image/png;base64,dark-bg", nodeBackgroundImage: "data:image/png;base64,dark-node" },
};

function settingsWithImages(overrides: Partial<Settings> = {}): Settings {
  return {
    ...DEFAULT_SETTINGS,
    ...overrides,
    light: { ...DEFAULT_SETTINGS.light, ...IMAGES.light, ...(overrides.light ?? {}) },
    dark: { ...DEFAULT_SETTINGS.dark, ...IMAGES.dark, ...(overrides.dark ?? {}) },
  };
}

function compactOf(settings: Settings): Settings {
  return {
    ...settings,
    light: { ...settings.light, backgroundImage: null, nodeBackgroundImage: null },
    dark: { ...settings.dark, backgroundImage: null, nodeBackgroundImage: null },
  };
}

function installChromeMock(options?: { localSetError?: Error }) {
  const syncStore: Record<string, unknown> = {};
  const localStore: Record<string, unknown> = {};

  const area = (store: Record<string, unknown>, rejectSet?: Error) => ({
    get: vi.fn(async (key: string) =>
      Object.prototype.hasOwnProperty.call(store, key) ? { [key]: store[key] } : {},
    ),
    set: vi.fn(async (items: Record<string, unknown>) => {
      if (rejectSet) throw rejectSet;
      Object.assign(store, items);
    }),
  });

  vi.stubGlobal("chrome", {
    storage: {
      sync: area(syncStore),
      local: area(localStore, options?.localSetError),
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  return { syncStore, localStore };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("saveSettings", () => {
  it("writes compact style to sync and images to local", async () => {
    const { syncStore, localStore } = installChromeMock();
    const settings = settingsWithImages({
      mode: "light",
      light: { ...DEFAULT_SETTINGS.light, ...IMAGES.light, nodeFill: "#ff00aa" },
    });

    await saveSettings(settings);

    const syncBag = syncStore[SYNC_KEY] as Settings;
    expect(syncBag.mode).toBe("light");
    expect(syncBag.light.nodeFill).toBe("#ff00aa");
    expect(syncBag.light.backgroundImage).toBeNull();
    expect(localStore[IMAGES_KEY]).toEqual(IMAGES);
  });

  it("still writes compact style to sync when local.set rejects", async () => {
    const { syncStore } = installChromeMock({ localSetError: new Error("quota") });
    await saveSettings(settingsWithImages({ mode: "light" }));
    expect((syncStore[SYNC_KEY] as Settings).mode).toBe("light");
  });
});

describe("loadSettings", () => {
  it("merges compact sync style with local images", async () => {
    const { syncStore, localStore } = installChromeMock();
    syncStore[SYNC_KEY] = compactOf(settingsWithImages({ mode: "light" }));
    localStore[IMAGES_KEY] = IMAGES;

    const loaded = await loadSettings();

    expect(loaded.mode).toBe("light");
    expect(loaded.light.backgroundImage).toBe(IMAGES.light.backgroundImage);
    expect(loaded.dark.nodeBackgroundImage).toBe(IMAGES.dark.nodeBackgroundImage);
  });

  it("keeps a legacy sync image when graphy.images is absent", async () => {
    const { syncStore } = installChromeMock();
    syncStore[SYNC_KEY] = {
      ...DEFAULT_SETTINGS,
      light: { ...DEFAULT_SETTINGS.light, backgroundImage: "data:image/png;base64,legacy" },
    };

    const loaded = await loadSettings();
    expect(loaded.light.backgroundImage).toBe("data:image/png;base64,legacy");
  });
});
