import { DEFAULT_SETTINGS, withDefaults, type Settings } from "./schema.js";

const SYNC_KEY = "graphy.settings";
const LOCAL_KEY = "graphy.panel";

export interface PanelState {
  x: number;
  y: number;
  width: number;
  height: number;
  open: boolean;
  collapsed: boolean;
}

export const DEFAULT_PANEL: PanelState = {
  x: -1,
  y: -1,
  width: 460,
  height: 520,
  open: false,
  collapsed: false,
};

export async function loadSettings(): Promise<Settings> {
  try {
    const bag = await chrome.storage.sync.get(SYNC_KEY);
    return withDefaults(bag[SYNC_KEY]);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  try {
    await chrome.storage.sync.set({ [SYNC_KEY]: settings });
  } catch {
    /* Quota or context teardown - the live UI already has the value. */
  }
}

export function onSettingsChanged(handler: (settings: Settings) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    if (area !== "sync" || !changes[SYNC_KEY]) return;
    handler(withDefaults(changes[SYNC_KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** Geometry is per-device, so it stays out of the synced quota. */
export async function loadPanelState(): Promise<PanelState> {
  try {
    const bag = await chrome.storage.local.get(LOCAL_KEY);
    return { ...DEFAULT_PANEL, ...((bag[LOCAL_KEY] as Partial<PanelState>) ?? {}) };
  } catch {
    return DEFAULT_PANEL;
  }
}

export async function savePanelState(state: PanelState): Promise<void> {
  try {
    await chrome.storage.local.set({ [LOCAL_KEY]: state });
  } catch {
    /* Quota or context teardown - geometry is not worth surfacing. */
  }
}

const OVERRIDE_KEY = "graphy.overrides";

export interface Override {
  kind?: string;
}

/** Manual corrections stick per problem, so a bad guess is fixed only once. */
export async function loadOverrides(): Promise<Record<string, Override>> {
  try {
    const bag = await chrome.storage.local.get(OVERRIDE_KEY);
    return (bag[OVERRIDE_KEY] as Record<string, Override>) ?? {};
  } catch {
    return {};
  }
}

export async function saveOverrides(all: Record<string, Override>): Promise<void> {
  const compact: Record<string, Override> = {};
  for (const [slug, override] of Object.entries(all)) {
    if (override.kind !== undefined) compact[slug] = { kind: override.kind };
  }
  try {
    await chrome.storage.local.set({ [OVERRIDE_KEY]: compact });
  } catch {
    /* Same - not worth surfacing. */
  }
}
