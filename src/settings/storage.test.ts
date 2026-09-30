import { afterEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, type Settings } from "./schema.js";

const storage = () => import("./storage.js");

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

  const sync = area(syncStore);
  const local = area(localStore, options?.localSetError);
  vi.stubGlobal("chrome", {
    storage: {
      sync,
      local,
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  });
  return { syncStore, localStore, sync, local };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("saveSettings", () => {
  it("writes compact style to sync and images to local", async () => {
    const { syncStore, localStore } = installChromeMock();
    const settings = settingsWithImages({
      mode: "light",
      light: { ...DEFAULT_SETTINGS.light, ...IMAGES.light, nodeFill: "#ff00aa" },
    });

    const { saveSettings } = await storage();
    await saveSettings(settings);

    const syncBag = syncStore[SYNC_KEY] as Settings;
    expect(syncBag.mode).toBe("light");
    expect(syncBag.light.nodeFill).toBe("#ff00aa");
    expect(syncBag.light.backgroundImage).toBeNull();
    expect(localStore[IMAGES_KEY]).toEqual(IMAGES);
  });

  it("still writes compact style to sync when local.set rejects", async () => {
    const { syncStore } = installChromeMock({ localSetError: new Error("quota") });
    const { saveSettings } = await storage();
    await saveSettings(settingsWithImages({ mode: "light" }));
    expect((syncStore[SYNC_KEY] as Settings).mode).toBe("light");
  });

  it("does not rewrite unchanged images when only style changes", async () => {
    const { syncStore, localStore, local } = installChromeMock();
    syncStore[SYNC_KEY] = compactOf(settingsWithImages());
    localStore[IMAGES_KEY] = IMAGES;
    const { loadSettings, saveSettings } = await storage();

    const loaded = await loadSettings();
    await saveSettings({ ...loaded, light: { ...loaded.light, nodeFill: "#123456" } });

    expect(local.set).not.toHaveBeenCalled();
    expect((syncStore[SYNC_KEY] as Settings).light.nodeFill).toBe("#123456");
  });

  it("writes images when one changes and remembers the write", async () => {
    const { localStore, local } = installChromeMock();
    localStore[IMAGES_KEY] = IMAGES;
    const { loadSettings, saveSettings } = await storage();

    const loaded = await loadSettings();
    const next = { ...loaded, dark: { ...loaded.dark, backgroundImage: "data:image/webp;base64,new" } };
    await saveSettings(next);
    await saveSettings({ ...next, autoOpen: true });

    expect(local.set).toHaveBeenCalledTimes(1);
    expect((localStore[IMAGES_KEY] as typeof IMAGES).dark.backgroundImage).toBe("data:image/webp;base64,new");
  });

  it("retries an image write that previously failed", async () => {
    const { local } = installChromeMock({ localSetError: new Error("quota") });
    const { saveSettings } = await storage();
    const settings = settingsWithImages();

    await saveSettings(settings);
    await saveSettings(settings);

    expect(local.set).toHaveBeenCalledTimes(2);
  });
});

describe("loadAutoOpen", () => {
  it("reads only the synced bag", async () => {
    const { syncStore, localStore, local } = installChromeMock();
    syncStore[SYNC_KEY] = { ...compactOf(settingsWithImages()), autoOpen: true };
    localStore[IMAGES_KEY] = IMAGES;
    const { loadAutoOpen } = await storage();

    await expect(loadAutoOpen()).resolves.toBe(true);
    expect(local.get).not.toHaveBeenCalled();
  });

  it("falls back to the default when sync is unavailable", async () => {
    vi.stubGlobal("chrome", { storage: { sync: { get: () => Promise.reject(new Error("gone")) } } });
    const { loadAutoOpen } = await storage();

    await expect(loadAutoOpen()).resolves.toBe(DEFAULT_SETTINGS.autoOpen);
  });
});

describe("loadSettings", () => {
  it("merges compact sync style with local images", async () => {
    const { syncStore, localStore } = installChromeMock();
    syncStore[SYNC_KEY] = compactOf(settingsWithImages({ mode: "light" }));
    localStore[IMAGES_KEY] = IMAGES;

    const { loadSettings } = await storage();
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

    const { loadSettings } = await storage();
    const loaded = await loadSettings();
    expect(loaded.light.backgroundImage).toBe("data:image/png;base64,legacy");
  });
});

describe("loadOverrides", () => {
  it("keeps only valid problem overrides and never spreads malformed values", async () => {
    const { localStore } = installChromeMock();
    localStore["graphy.overrides"] = {
      "two-sum": { kind: "matrix" },
      "bad-kind": { kind: "not-a-kind" },
      "bad-value": "binary-tree",
      "empty": {},
    };

    const { loadOverrides } = await storage();
    await expect(loadOverrides()).resolves.toEqual({
      "two-sum": { kind: "matrix" },
    });
  });
});

describe("withOverrideKind", () => {
  it("sets a kind per slug and removes the slug entry when cleared back to auto", async () => {
    const { localStore } = installChromeMock();
    const { saveOverrides, withOverrideKind } = await storage();

    const set = withOverrideKind({ "two-sum": { kind: "matrix" } }, "same-tree", "binary-tree");
    expect(set).toEqual({ "two-sum": { kind: "matrix" }, "same-tree": { kind: "binary-tree" } });

    const cleared = withOverrideKind(set, "two-sum", undefined);
    expect(cleared).toEqual({ "same-tree": { kind: "binary-tree" } });
    expect(set).toHaveProperty("two-sum");

    await saveOverrides(cleared);
    expect(localStore["graphy.overrides"]).toEqual({ "same-tree": { kind: "binary-tree" } });
  });
});

describe("privacy notice storage", () => {
  it("defaults to visible and persists dismissal in local storage", async () => {
    const { localStore } = installChromeMock();
    const { loadPrivacyNoticeDismissed, savePrivacyNoticeDismissed } = await storage();

    await expect(loadPrivacyNoticeDismissed()).resolves.toBe(false);
    await savePrivacyNoticeDismissed();
    expect(localStore["graphy.privacyNoticeDismissed"]).toBe(true);
    await expect(loadPrivacyNoticeDismissed()).resolves.toBe(true);
  });
});
