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

type Listener = (changes: Record<string, { newValue?: unknown; oldValue?: unknown }>, area: string) => void;

function installChromeMock(options?: { localSetError?: Error; holdLocalSet?: boolean }) {
  const syncStore: Record<string, unknown> = {};
  const localStore: Record<string, unknown> = {};
  const listeners: Listener[] = [];
  const heldLocal: Array<() => void> = [];

  const area = (name: string, store: Record<string, unknown>, rejectSet?: Error, hold?: boolean) => ({
    get: vi.fn(async (key: string) =>
      Object.prototype.hasOwnProperty.call(store, key) ? { [key]: store[key] } : {},
    ),
    set: vi.fn(async (items: Record<string, unknown>) => {
      if (rejectSet) throw rejectSet;
      if (hold) await new Promise<void>((resolve) => heldLocal.push(resolve));
      Object.assign(store, items);
      const changes = Object.fromEntries(Object.entries(items).map(([key, value]) => [key, { newValue: structuredClone(value) }]));
      for (const listener of listeners) listener(changes, name);
    }),
  });

  const sync = area("sync", syncStore);
  const local = area("local", localStore, options?.localSetError, options?.holdLocalSet);
  vi.stubGlobal("chrome", {
    storage: {
      sync,
      local,
      onChanged: {
        addListener: vi.fn((listener: Listener) => listeners.push(listener)),
        removeListener: vi.fn((listener: Listener) => listeners.splice(listeners.indexOf(listener), 1)),
      },
    },
  });
  const emit = (area: string, key: string, newValue: unknown) => {
    for (const listener of [...listeners]) listener({ [key]: { newValue } }, area);
  };
  return { syncStore, localStore, sync, local, emit, heldLocal };
}

function collect(onSettingsChanged: (handler: (update: (prev: Settings) => Settings) => void) => () => void, start: Settings) {
  const state = { current: start, calls: 0 };
  const stop = onSettingsChanged((update) => {
    state.calls += 1;
    state.current = update(state.current);
  });
  return { state, stop };
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

describe("saveSettings writes", () => {
  it("does not wait for the image write before writing style to sync", async () => {
    const { sync, local, heldLocal } = installChromeMock({ holdLocalSet: true });
    const { saveSettings } = await storage();
    const saving = saveSettings(settingsWithImages({ mode: "light" }));
    await Promise.resolve();
    expect(local.set).toHaveBeenCalledTimes(1);
    expect(sync.set).toHaveBeenCalledTimes(1);
    heldLocal.forEach((resolve) => resolve());
    await saving;
  });

  it("skips the sync write when the compact style is unchanged", async () => {
    const { syncStore, sync } = installChromeMock();
    syncStore[SYNC_KEY] = compactOf(settingsWithImages());
    const { loadSettings, saveSettings } = await storage();
    const loaded = await loadSettings();
    await saveSettings(loaded);
    expect(sync.set).not.toHaveBeenCalled();
    await saveSettings({ ...loaded, mode: "light" });
    await saveSettings({ ...loaded, mode: "light" });
    expect(sync.set).toHaveBeenCalledTimes(1);
  });

  it("tags sync writes with this panel's writer id and an increasing revision", async () => {
    const { syncStore } = installChromeMock();
    const { saveSettings, writeMetaOf, WRITER_ID } = await storage();
    await saveSettings({ ...DEFAULT_SETTINGS, mode: "light" });
    expect(writeMetaOf(syncStore[SYNC_KEY])).toEqual({ writer: WRITER_ID, rev: 1 });
    await saveSettings({ ...DEFAULT_SETTINGS, mode: "dark" });
    expect(writeMetaOf(syncStore[SYNC_KEY])).toEqual({ writer: WRITER_ID, rev: 2 });
  });
});

describe("onSettingsChanged", () => {
  it("ignores echoes of this panel's own writes", async () => {
    installChromeMock();
    const { onSettingsChanged, saveSettings } = await storage();
    const { state } = collect(onSettingsChanged, DEFAULT_SETTINGS);
    await saveSettings(settingsWithImages({ mode: "light" }));
    expect(state.calls).toBe(0);
  });

  it("applies style from another writer and keeps the current images without reading local storage", async () => {
    const { localStore, local, emit } = installChromeMock();
    localStore[IMAGES_KEY] = IMAGES;
    const { loadSettings, onSettingsChanged } = await storage();
    const loaded = await loadSettings();
    local.get.mockClear();
    const { state } = collect(onSettingsChanged, loaded);
    emit("sync", SYNC_KEY, { ...compactOf(loaded), mode: "light", light: { ...loaded.light, nodeFill: "#00ff00", backgroundImage: null }, meta: { writer: "other", rev: 1 } });
    expect(state.calls).toBe(1);
    expect(state.current.mode).toBe("light");
    expect(state.current.light.nodeFill).toBe("#00ff00");
    expect(state.current.light.backgroundImage).toBe(IMAGES.light.backgroundImage);
    expect(local.get).not.toHaveBeenCalled();
  });

  it("drops stale revisions from another writer", async () => {
    const { emit } = installChromeMock();
    const { onSettingsChanged } = await storage();
    const { state } = collect(onSettingsChanged, DEFAULT_SETTINGS);
    emit("sync", SYNC_KEY, { ...DEFAULT_SETTINGS, mode: "light", meta: { writer: "other", rev: 2 } });
    emit("sync", SYNC_KEY, { ...DEFAULT_SETTINGS, mode: "dark", meta: { writer: "other", rev: 1 } });
    expect(state.calls).toBe(1);
    expect(state.current.mode).toBe("light");
  });

  it("merges only images when another panel changes the image store", async () => {
    const { localStore, emit } = installChromeMock();
    localStore[IMAGES_KEY] = IMAGES;
    const { loadSettings, onSettingsChanged } = await storage();
    const loaded = await loadSettings();
    const edited = { ...loaded, light: { ...loaded.light, nodeFill: "#abcdef" } };
    const { state } = collect(onSettingsChanged, edited);
    emit("local", IMAGES_KEY, IMAGES);
    expect(state.calls).toBe(0);
    const next = { ...IMAGES, dark: { ...IMAGES.dark, backgroundImage: "data:image/png;base64,next" } };
    emit("local", IMAGES_KEY, next);
    expect(state.calls).toBe(1);
    expect(state.current.dark.backgroundImage).toBe("data:image/png;base64,next");
    expect(state.current.light.nodeFill).toBe("#abcdef");
  });

  it("ignores unrelated keys and stops listening when disposed", async () => {
    const { emit } = installChromeMock();
    const { onSettingsChanged } = await storage();
    const { state, stop } = collect(onSettingsChanged, DEFAULT_SETTINGS);
    emit("local", "graphy.panel", { x: 1 });
    emit("sync", "graphy.other", 1);
    stop();
    emit("sync", SYNC_KEY, { ...DEFAULT_SETTINGS, mode: "light", meta: { writer: "other", rev: 1 } });
    expect(state.calls).toBe(0);
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

describe("review button storage", () => {
  it("defaults to shown and syncs the choice to hide it", async () => {
    const { syncStore } = installChromeMock();
    const { loadReviewHidden, saveReviewHidden } = await storage();

    await expect(loadReviewHidden()).resolves.toBe(false);
    await saveReviewHidden();
    expect(syncStore["graphy.reviewHidden"]).toBe(true);
    await expect(loadReviewHidden()).resolves.toBe(true);
  });
});
