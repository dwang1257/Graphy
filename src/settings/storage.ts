import { DEFAULT_SETTINGS, asRecord, withDefaults, type Settings } from "./schema.js";
import { extractImages, mergeImages, sameImages, sanitizeImageAssets, stripImages, type ImageAssets } from "./split.js";
import { isStructureKind, type StructureKind } from "../core/types.js";

const SYNC_KEY = "graphy.settings";
const LOCAL_KEY = "graphy.panel";
const IMAGES_KEY = "graphy.images";
const OVERRIDE_KEY = "graphy.overrides";
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

function sanitizePanelState(stored: unknown): PanelState {
  const raw = asRecord(stored);
  return {
    x: finiteNumber(raw.x, DEFAULT_PANEL.x),
    y: finiteNumber(raw.y, DEFAULT_PANEL.y),
    width: finiteNumber(raw.width, DEFAULT_PANEL.width),
    height: finiteNumber(raw.height, DEFAULT_PANEL.height),
    open: raw.open === true,
    shrunk: raw.shrunk === true,
  };
}

export interface WriteMeta {
  writer: string;
  rev: number;
}

export type SettingsUpdate = (prev: Settings) => Settings;

function randomWriterId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const WRITER_ID = randomWriterId();

let rev = 0;
let storedImages: ImageAssets | null = null;
let lastSyncJson: string | null = null;
const seenRevs = new Map<string, number>();

function compactJson(settings: Settings): string {
  return JSON.stringify(stripImages(settings));
}

async function settle(write: () => Promise<void>): Promise<boolean> {
  try {
    await write();
    return true;
  } catch {
    return false;
  }
}

export function writeMetaOf(stored: unknown): WriteMeta | null {
  const { writer, rev: written } = asRecord(asRecord(stored).meta);
  if (typeof writer !== "string" || typeof written !== "number" || !Number.isFinite(written)) return null;
  return { writer, rev: written };
}

export async function loadSettings(): Promise<Settings> {
  try {
    const [syncBag, localBag] = await Promise.all([
      chrome.storage.sync.get(SYNC_KEY),
      chrome.storage.local.get(IMAGES_KEY),
    ]);
    let settings = withDefaults(syncBag[SYNC_KEY]);
    if (Object.hasOwn(localBag, IMAGES_KEY)) {
      storedImages = sanitizeImageAssets(localBag[IMAGES_KEY]);
      settings = mergeImages(settings, storedImages);
    }
    if (Object.hasOwn(syncBag, SYNC_KEY)) lastSyncJson = compactJson(settings);
    return settings;
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

async function writeImages(images: ImageAssets): Promise<void> {
  if (storedImages && sameImages(storedImages, images)) return;
  const previous = storedImages;
  storedImages = images;
  const ok = await settle(() => chrome.storage.local.set({ [IMAGES_KEY]: images }));
  if (!ok && storedImages === images) storedImages = previous;
}

async function writeStyle(settings: Settings): Promise<void> {
  const compact = stripImages(settings);
  const json = JSON.stringify(compact);
  if (json === lastSyncJson) return;
  lastSyncJson = json;
  rev += 1;
  const meta: WriteMeta = { writer: WRITER_ID, rev };
  const ok = await settle(() => chrome.storage.sync.set({ [SYNC_KEY]: { ...compact, meta } }));
  if (!ok && lastSyncJson === json) lastSyncJson = null;
}

export async function saveSettings(settings: Settings): Promise<void> {
  await Promise.all([writeImages(extractImages(settings)), writeStyle(settings)]);
}

function isFreshRemote(meta: WriteMeta | null): boolean {
  if (!meta) return true;
  if (meta.writer === WRITER_ID) return false;
  const seen = seenRevs.get(meta.writer);
  if (seen !== undefined && meta.rev <= seen) return false;
  seenRevs.set(meta.writer, meta.rev);
  return true;
}

export function onSettingsChanged(handler: (update: SettingsUpdate) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    area: string,
  ): void => {
    const imagesChange = area === "local" ? changes[IMAGES_KEY] : undefined;
    if (imagesChange) {
      const images = sanitizeImageAssets(imagesChange.newValue);
      if (storedImages && sameImages(storedImages, images)) return;
      storedImages = images;
      handler((prev) => mergeImages(prev, images));
      return;
    }
    const syncChange = area === "sync" ? changes[SYNC_KEY] : undefined;
    if (!syncChange) return;
    const value: unknown = syncChange.newValue;
    if (!isFreshRemote(writeMetaOf(value))) return;
    const incoming = withDefaults(value);
    lastSyncJson = compactJson(incoming);
    if (storedImages) handler((prev) => mergeImages(incoming, extractImages(prev)));
    else handler(() => incoming);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

export async function loadPanelState(): Promise<PanelState> {
  try {
    const bag = await chrome.storage.local.get(LOCAL_KEY);
    return sanitizePanelState(bag[LOCAL_KEY]);
  } catch {
    return { ...DEFAULT_PANEL };
  }
}

export async function savePanelState(state: PanelState): Promise<void> {
  await settle(() => chrome.storage.local.set({ [LOCAL_KEY]: state }));
}

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

function sanitizeOverrides(stored: unknown): Record<string, Override> {
  const out: Record<string, Override> = {};
  for (const [slug, raw] of Object.entries(asRecord(stored))) {
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
