type Bag = Record<string, unknown>;
type AreaName = "sync" | "local";
type StorageChange = { oldValue?: unknown; newValue?: unknown };
type ChangeListener = (changes: Record<string, StorageChange>, areaName: AreaName) => void;
type Keys = string | string[] | Bag | null | undefined;

interface Quota {
  total: number;
  perItem: number;
}

const STORAGE_PREFIX = "graphyHarness:storage:";
const AREAS: AreaName[] = ["sync", "local"];
const QUOTAS: Record<AreaName, Quota> = {
  sync: { total: 102_400, perItem: 8_192 },
  local: { total: 10_485_760, perItem: Number.POSITIVE_INFINITY },
};

function storageKey(area: AreaName): string {
  return `${STORAGE_PREFIX}${area}`;
}

function isBag(value: unknown): value is Bag {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function clone<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

function parseBag(raw: string | null): Bag {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return isBag(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function readPersisted(area: AreaName): Bag {
  try {
    return parseBag(localStorage.getItem(storageKey(area)));
  } catch {
    return {};
  }
}

function writePersisted(area: AreaName, bag: Bag): void {
  try {
    localStorage.setItem(storageKey(area), JSON.stringify(bag));
  } catch {
    return;
  }
}

function diff(before: Bag, after: Bag): Record<string, StorageChange> {
  const changes: Record<string, StorageChange> = {};
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const oldJson = JSON.stringify(before[key]);
    const newJson = JSON.stringify(after[key]);
    if (oldJson === newJson) continue;
    const change: StorageChange = {};
    if (key in before) change.oldValue = clone(before[key]);
    if (key in after) change.newValue = clone(after[key]);
    changes[key] = change;
  }
  return changes;
}

function itemBytes(key: string, value: unknown): number {
  return key.length + JSON.stringify(value).length;
}

function checkQuota(area: AreaName, bag: Bag): void {
  const quota = QUOTAS[area];
  let total = 0;
  for (const [key, value] of Object.entries(bag)) {
    const bytes = itemBytes(key, value);
    if (bytes > quota.perItem) throw new Error(`QUOTA_BYTES_PER_ITEM quota exceeded for "${key}" in storage.${area}`);
    total += bytes;
  }
  if (total > quota.total) throw new Error(`QUOTA_BYTES quota exceeded in storage.${area}`);
}

function createEvent<Listener extends (...args: never[]) => unknown>() {
  const listeners = new Set<Listener>();
  return {
    listeners,
    addListener: (listener: Listener): void => {
      listeners.add(listener);
    },
    removeListener: (listener: Listener): void => {
      listeners.delete(listener);
    },
    hasListener: (listener: Listener): boolean => listeners.has(listener),
    hasListeners: (): boolean => listeners.size > 0,
  };
}

function settle<T>(work: () => T, callback: ((value: T) => void) | undefined): Promise<T> | undefined {
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    try {
      resolvePromise(work());
    } catch (error) {
      rejectPromise(error);
    }
  });
  if (!callback) return promise;
  promise.then(
    (value) => setTimeout(() => callback(value), 0),
    (error: unknown) => console.error("[graphy harness] chrome.storage callback error", error),
  );
  return undefined;
}

function pick(bag: Bag, keys: Keys): Bag {
  if (keys === null || keys === undefined) return clone(bag);
  if (typeof keys === "string") return pick(bag, [keys]);
  if (Array.isArray(keys)) {
    const out: Bag = {};
    for (const key of keys) {
      if (key in bag) out[key] = clone(bag[key]);
    }
    return out;
  }
  const out: Bag = {};
  for (const [key, fallback] of Object.entries(keys)) {
    out[key] = key in bag ? clone(bag[key]) : clone(fallback);
  }
  return out;
}

export function installChromeShim(): void {
  const memory: Record<AreaName, Bag> = { sync: readPersisted("sync"), local: readPersisted("local") };
  const onChanged = createEvent<ChangeListener>();
  const onMessage = createEvent<(message: unknown, sender: unknown, sendResponse: (response?: unknown) => void) => unknown>();

  const emit = (changes: Record<string, StorageChange>, area: AreaName): void => {
    if (Object.keys(changes).length === 0) return;
    setTimeout(() => {
      for (const listener of [...onChanged.listeners]) listener(clone(changes), area);
    }, 0);
  };

  const commit = (area: AreaName, next: Bag): void => {
    checkQuota(area, next);
    const changes = diff(memory[area], next);
    memory[area] = next;
    writePersisted(area, next);
    emit(changes, area);
  };

  const storageArea = (area: AreaName) => ({
    QUOTA_BYTES: QUOTAS[area].total,
    QUOTA_BYTES_PER_ITEM: QUOTAS[area].perItem,
    get: (keys?: Keys | ((items: Bag) => void), callback?: (items: Bag) => void) => {
      if (typeof keys === "function") return settle(() => pick(memory[area], null), keys);
      return settle(() => pick(memory[area], keys), callback);
    },
    set: (items: Bag, callback?: () => void) =>
      settle(() => commit(area, { ...memory[area], ...clone(items) }), callback),
    remove: (keys: string | string[], callback?: () => void) =>
      settle(() => {
        const next = { ...memory[area] };
        for (const key of typeof keys === "string" ? [keys] : keys) delete next[key];
        commit(area, next);
      }, callback),
    clear: (callback?: () => void) => settle(() => commit(area, {}), callback),
    getBytesInUse: (keys?: Keys, callback?: (bytes: number) => void) =>
      settle(
        () => Object.entries(pick(memory[area], keys ?? null)).reduce((sum, [key, value]) => sum + itemBytes(key, value), 0),
        callback,
      ),
  });

  window.addEventListener("storage", (event) => {
    const area = AREAS.find((name) => event.key === null || event.key === storageKey(name));
    if (!area || (event.storageArea && event.storageArea !== localStorage)) return;
    for (const name of event.key === null ? AREAS : [area]) {
      const next = readPersisted(name);
      const changes = diff(memory[name], next);
      memory[name] = next;
      emit(changes, name);
    }
  });

  const runtime = {
    id: "graphy-harness",
    lastError: undefined,
    getURL: (path: string): string => new URL(path.replace(/^\/+/, ""), `${location.origin}/`).href,
    getManifest: () => ({ manifest_version: 3, name: "Graphy", version: "0.0.0-harness" }),
    sendMessage: (...args: unknown[]) => {
      const callback = args.find((arg): arg is (response: unknown) => void => typeof arg === "function");
      console.info("[graphy harness] chrome.runtime.sendMessage", ...args.filter((arg) => typeof arg !== "function"));
      return settle(() => undefined, callback);
    },
    onMessage,
  };

  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    writable: true,
    value: {
      storage: {
        sync: storageArea("sync"),
        local: storageArea("local"),
        onChanged,
      },
      runtime,
    },
  });
}
