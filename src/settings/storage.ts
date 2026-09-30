import { DEFAULT_SETTINGS, withDefaults, type Settings } from "./schema.js";
import { extractImages, sameImages, sanitizeImageAssets, settingsFromStores, stripImages, type ImageAssets } from "./split.js";
import { isStructureKind, type StructureKind } from "../core/types.js";

const SYNC_KEY = "graphy.settings";
const LOCAL_KEY = "graphy.panel";
const IMAGES_KEY = "graphy.images";
const PRIVACY_NOTICE_KEY = "graphy.privacyNoticeDismissed";

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

let storedImages: ImageAssets | null = null;

function rememberImages(localBag: Record<string, unknown>): void {
  storedImages = sanitizeImageAssets(localBag[IMAGES_KEY]);
}

export async function loadSettings(): Promise<Settings> {
  try {
    const [syncBag, localBag] = await Promise.all([
      chrome.storage.sync.get(SYNC_KEY),
      chrome.storage.local.get(IMAGES_KEY),
    ]);
    rememberImages(localBag);
    return settingsFromStores(
      syncBag[SYNC_KEY],
      localBag[IMAGES_KEY],
      Object.prototype.hasOwnProperty.call(localBag, IMAGES_KEY),
    );
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function loadAutoOpen(): Promise<boolean> {
  try {
    const syncBag = await chrome.storage.sync.get(SYNC_KEY);
    return withDefaults(syncBag[SYNC_KEY]).autoOpen;
  } catch {
    return DEFAULT_SETTINGS.autoOpen;
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  const compact = stripImages(settings);
  const images = extractImages(settings);
  const imagesChanged = !storedImages || !sameImages(storedImages, images);
  if (imagesChanged && await settle(() => chrome.storage.local.set({ [IMAGES_KEY]: images }))) {
    storedImages = images;
  }
  await settle(() => chrome.storage.sync.set({ [SYNC_KEY]: compact }));
}

async function settle(write: () => Promise<void>): Promise<boolean> {
  try {
    await write();
    return true;
  } catch {
    return false;
  }
}

export function onSettingsChanged(handler: (settings: Settings) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    const syncChange = changes[SYNC_KEY];
    if (area !== "sync" || !syncChange) return;
    const syncValue = syncChange.newValue;
    void chrome.storage.local.get(IMAGES_KEY).then(
      (localBag) => {
        rememberImages(localBag);
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

export async function loadPanelState(): Promise<PanelState> {
  try {
    const bag = await chrome.storage.local.get(LOCAL_KEY);
    return sanitizePanelState(bag[LOCAL_KEY]);
  } catch {
    return DEFAULT_PANEL;
  }
}

export async function savePanelState(state: PanelState): Promise<void> {
  await settle(() => chrome.storage.local.set({ [LOCAL_KEY]: state }));
}

const OVERRIDE_KEY = "graphy.overrides";

export interface Override {
  kind?: StructureKind;
}

export async function loadOverrides(): Promise<Record<string, Override>> {
  try {
    const bag = await chrome.storage.local.get(OVERRIDE_KEY);
    return sanitizeOverrides(bag[OVERRIDE_KEY]);
  } catch {
    return {};
  }
}

export function sanitizeOverrides(stored: unknown): Record<string, Override> {
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return {};
  const out: Record<string, Override> = {};
  const entries: Array<[string, unknown]> = Object.entries(stored);
  for (const [slug, raw] of entries) {
    if (!slug || slug.length > 128 || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const kind = "kind" in raw ? raw.kind : undefined;
    if (isStructureKind(kind)) out[slug] = { kind };
  }
  return out;
}

export async function saveOverrides(all: Record<string, Override>): Promise<void> {
  const compact = sanitizeOverrides(all);
  await settle(() => chrome.storage.local.set({ [OVERRIDE_KEY]: compact }));
}

export function withOverrideKind(
  all: Readonly<Record<string, Override>>,
  slug: string,
  kind: StructureKind | undefined,
): Record<string, Override> {
  const next = { ...all };
  if (kind) next[slug] = { ...next[slug], kind };
  else delete next[slug];
  return next;
}

export async function loadPrivacyNoticeDismissed(): Promise<boolean> {
  try {
    const bag = await chrome.storage.local.get(PRIVACY_NOTICE_KEY);
    return bag[PRIVACY_NOTICE_KEY] === true;
  } catch {
    return false;
  }
}

export async function savePrivacyNoticeDismissed(): Promise<void> {
  await settle(() => chrome.storage.local.set({ [PRIVACY_NOTICE_KEY]: true }));
}
