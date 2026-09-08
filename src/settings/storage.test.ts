import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, type Settings } from "./schema.js";
import {
  DEFAULT_PANEL,
  loadSettings,
  onSettingsChanged,
  sanitizePanelState,
  saveSettings,
} from "./storage.js";

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

function imageFields(palette: { backgroundImage: string | null; nodeBackgroundImage: string | null }) {
  return [palette.backgroundImage, palette.nodeBackgroundImage];
}

type StorageChangeListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void;

function installChromeMock(options?: { localSetError?: Error }) {
  const syncStore: Record<string, unknown> = {};
  const localStore: Record<string, unknown> = {};
  const listeners = new Set<StorageChangeListener>();

  const area = (store: Record<string, unknown>, rejectSet?: Error) => ({
    get: vi.fn(async (key: string) =>
      Object.prototype.hasOwnProperty.call(store, key) ? { [key]: store[key] } : {},
    ),
    set: vi.fn(async (items: Record<string, unknown>) => {
      if (rejectSet) throw rejectSet;
      Object.assign(store, items);
    }),
  });

  const sync = area(syncStore);
  const local = area(localStore, options?.localSetError);
  const onChanged = {
    addListener: vi.fn((listener: StorageChangeListener) => {
      listeners.add(listener);
    }),
    removeListener: vi.fn((listener: StorageChangeListener) => {
      listeners.delete(listener);
    }),
    emit(changes: Record<string, chrome.storage.StorageChange>, areaName: string) {
      for (const listener of listeners) listener(changes, areaName);
    },
  };

  vi.stubGlobal("chrome", { storage: { sync, local, onChanged } });
  return { syncStore, localStore, sync, local, onChanged };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sanitizePanelState", () => {
  it("keeps a complete valid payload", () => {
    const stored = { x: 10, y: 20, width: 400, height: 300, open: true, shrunk: true };
    expect(sanitizePanelState(stored)).toEqual(stored);
  });

  it("rejects non-boolean shrunk/open and non-finite geometry", () => {
    expect(
      sanitizePanelState({
        x: "10",
        y: Number.NaN,
        width: "wide",
        height: Number.POSITIVE_INFINITY,
        open: 1,
        shrunk: "true",
      }),
    ).toEqual(DEFAULT_PANEL);
  });

  it("fills missing keys from defaults", () => {
    expect(sanitizePanelState({})).toEqual(DEFAULT_PANEL);
    expect(sanitizePanelState(null)).toEqual(DEFAULT_PANEL);
  });
});

describe("saveSettings", () => {
  it("writes colors, mode, and layout to sync without image data URLs", async () => {
    const { syncStore } = installChromeMock();
    const settings = settingsWithImages({
      mode: "light",
      light: { ...DEFAULT_SETTINGS.light, ...IMAGES.light, nodeFill: "#ff00aa" },
    });

    await saveSettings(settings);

    const syncBag = syncStore[SYNC_KEY] as Settings;
    expect(syncBag.mode).toBe("light");
    expect(syncBag.light.nodeFill).toBe("#ff00aa");
    expect(syncBag.layout.nodeShape).toBe(settings.layout.nodeShape);
    expect(imageFields(syncBag.light).every((value) => value == null)).toBe(true);
    expect(imageFields(syncBag.dark).every((value) => value == null)).toBe(true);
  });

  it("writes background and node images to local graphy.images", async () => {
    const { localStore } = installChromeMock();

    await saveSettings(settingsWithImages());

    expect(localStore[IMAGES_KEY]).toEqual(IMAGES);
  });

  it("still writes compact style to sync when local.set rejects", async () => {
    const { syncStore } = installChromeMock({ localSetError: new Error("quota") });
    const settings = settingsWithImages({
      mode: "light",
      light: { ...DEFAULT_SETTINGS.light, ...IMAGES.light, nodeFill: "#00aabb" },
    });

    await saveSettings(settings);

    const syncBag = syncStore[SYNC_KEY] as Settings;
    expect(syncBag.mode).toBe("light");
    expect(syncBag.light.nodeFill).toBe("#00aabb");
    expect(imageFields(syncBag.light).every((value) => value == null)).toBe(true);
    expect(imageFields(syncBag.dark).every((value) => value == null)).toBe(true);
  });
});

describe("loadSettings", () => {
  it("merges compact sync style with local images", async () => {
    const { syncStore, localStore } = installChromeMock();
    const settings = settingsWithImages({ mode: "light" });
    syncStore[SYNC_KEY] = compactOf(settings);
    localStore[IMAGES_KEY] = IMAGES;

    const loaded = await loadSettings();

    expect(loaded.mode).toBe("light");
    expect(loaded.light.backgroundImage).toBe(IMAGES.light.backgroundImage);
    expect(loaded.light.nodeBackgroundImage).toBe(IMAGES.light.nodeBackgroundImage);
    expect(loaded.dark.backgroundImage).toBe(IMAGES.dark.backgroundImage);
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

describe("onSettingsChanged", () => {
  it("re-merges local images when sync settings change", async () => {
    const { localStore, onChanged } = installChromeMock();
    localStore[IMAGES_KEY] = IMAGES;
    const compact = compactOf(settingsWithImages({ mode: "light" }));

    const received = new Promise<Settings>((resolve) => {
      onSettingsChanged(resolve);
    });
    onChanged.emit({ [SYNC_KEY]: { newValue: compact } }, "sync");

    const settings = await received;
    expect(settings.mode).toBe("light");
    expect(settings.light.backgroundImage).toBe(IMAGES.light.backgroundImage);
    expect(settings.dark.nodeBackgroundImage).toBe(IMAGES.dark.nodeBackgroundImage);
  });
});
