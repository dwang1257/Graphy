import { DEFAULT_SETTINGS, type Settings } from "./schema.js";
import { extractImages, settingsFromStores, stripImages } from "./split.js";

const SYNC_KEY = "graphy.settings";
const LOCAL_KEY = "graphy.panel";
/** Data URLs blow the sync quota, so photos stay on-device. */
const IMAGES_KEY = "graphy.images";

export interface PanelState {
  x: number;
  y: number;
  width: number;
  height: number;
  open: boolean;
  shrunk: boolean;
}

export const DEFAULT_PANEL: PanelState = {
  x: -1,
  y: -1,
  width: 460,
  height: 520,
  open: false,
  shrunk: false,
};

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Coerce chrome.storage payloads so a stale or partial bag cannot poison layout. */
export function sanitizePanelState(stored: unknown): PanelState {
  const raw = stored && typeof stored === "object" ? (stored as Record<string, unknown>) : {};
  return {
    x: finiteNumber(raw.x, DEFAULT_PANEL.x),
    y: finiteNumber(raw.y, DEFAULT_PANEL.y),
    width: finiteNumber(raw.width, DEFAULT_PANEL.width),
    height: finiteNumber(raw.height, DEFAULT_PANEL.height),
    open: raw.open === true,
    shrunk: raw.shrunk === true,
  };
}

export async function loadSettings(): Promise<Settings> {
  try {
    const [syncBag, localBag] = await Promise.all([
      chrome.storage.sync.get(SYNC_KEY),
      chrome.storage.local.get(IMAGES_KEY),
    ]);
    return settingsFromStores(
      syncBag[SYNC_KEY],
      localBag[IMAGES_KEY],
      Object.prototype.hasOwnProperty.call(localBag, IMAGES_KEY),
    );
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const compact = stripImages(settings);
  const images = extractImages(settings);
  try {
    await chrome.storage.local.set({ [IMAGES_KEY]: images });
  } catch {
    /* Image quota must not block colors. */
  }
  try {
    await chrome.storage.sync.set({ [SYNC_KEY]: compact });
  } catch {
    /* Quota or context teardown - the live UI already has the value. */
  }
}

export function onSettingsChanged(handler: (settings: Settings) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    // Compact sync writes null images; overlay local so photos are not wiped.
    // Ignore local image events — a same-tab save writes local first, and
    // applying that against still-old sync would flash previous colors.
    const syncChange = changes[SYNC_KEY];
    if (area !== "sync" || !syncChange) return;
    const syncValue = syncChange.newValue;
    void chrome.storage.local.get(IMAGES_KEY).then(
      (localBag) => {
        handler(
          settingsFromStores(
            syncValue,
            localBag[IMAGES_KEY],
            Object.prototype.hasOwnProperty.call(localBag, IMAGES_KEY),
          ),
        );
      },
      () => {
        handler(settingsFromStores(syncValue, undefined, false));
      },
    );
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** Geometry is per-device, so it stays out of the synced quota. */
export async function loadPanelState(): Promise<PanelState> {
  try {
    const bag = await chrome.storage.local.get(LOCAL_KEY);
    return sanitizePanelState(bag[LOCAL_KEY]);
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
