import { afterEach, expect, test, vi } from "vitest";

const hookMessages: boolean[] = [];
const panelMessages: Array<{ channel: string; type: string }> = [];
const scripts: Array<{ src: string; fireLoad(): void }> = [];

class FakePanelHost {
  restored = Promise.resolve();
  isOpen = false;

  constructor(_url: string) {}

  open(): void {
    this.isOpen = true;
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  destroy(): void {}

  send(message: { channel: string; type: string }): void {
    panelMessages.push(message);
  }
}

vi.mock("./host.js", () => ({ PanelHost: FakePanelHost }));
vi.mock("./pageTrace.js", () => ({
  notifyPageHooks: (enabled: boolean) => hookMessages.push(enabled),
  notifyPageTrace: () => undefined,
}));
vi.mock("../settings/storage.js", () => ({
  loadSettings: () => Promise.resolve({ autoOpen: false }),
}));

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  hookMessages.length = 0;
  panelMessages.length = 0;
  scripts.length = 0;
});

test("injects once on problem entry, toggles hooks across SPA navigation, and clears the panel", async () => {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const locationState = { pathname: "/discuss/example" };
  const historyState = {
    pushState: (_state: unknown, _title: string, path: string) => {
      locationState.pathname = path;
    },
    replaceState: (_state: unknown, _title: string, path: string) => {
      locationState.pathname = path;
    },
  };
  const fakeWindow = {
    addEventListener: (type: string, listener: (...args: unknown[]) => void) => {
      const entries = listeners.get(type) ?? [];
      entries.push(listener);
      listeners.set(type, entries);
    },
    setInterval: () => 0,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    history: historyState,
  };
  const fakeDocument = {
    readyState: "complete",
    body: {},
    documentElement: {},
    head: {
      prepend: (script: {
        src: string;
        addEventListener(type: string, listener: () => void): void;
        remove(): void;
        fireLoad(): void;
      }) => {
        scripts.push({ src: script.src, fireLoad: () => script.fireLoad() });
      },
    },
    createElement: () => {
      let loadListener: (() => void) | undefined;
      return {
        async: false,
        src: "",
        addEventListener: (type: string, listener: () => void) => {
          if (type === "load") loadListener = listener;
        },
        remove: () => undefined,
        fireLoad: () => loadListener?.(),
      };
    },
    getElementById: () => null,
  };
  const chromeState = {
    runtime: {
      getURL: (path: string) => `chrome-extension://graphy/${path}`,
      onMessage: { addListener: () => undefined },
    },
  };

  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("location", locationState);
  vi.stubGlobal("history", historyState);
  vi.stubGlobal("chrome", chromeState);

  await import("./index.js");
  expect(scripts).toHaveLength(0);
  expect(hookMessages).toEqual([]);

  history.pushState({}, "", "/problems/first");
  await Promise.resolve();
  expect(scripts).toHaveLength(1);
  scripts[0]?.fireLoad();
  expect(hookMessages).toEqual([true]);

  const clearCountBeforeForeignMessage = panelMessages.filter((message) => message.type === "clear").length;
  for (const listener of listeners.get("message") ?? []) {
    listener({
      source: fakeWindow,
      origin: "https://attacker.example",
      data: { channel: "graphy:page", type: "clear" },
    });
  }
  expect(panelMessages.filter((message) => message.type === "clear")).toHaveLength(
    clearCountBeforeForeignMessage,
  );

  history.pushState({}, "", "/problems/second");
  await Promise.resolve();
  expect(scripts).toHaveLength(1);
  expect(hookMessages).toEqual([true, true]);
  expect(panelMessages.some((message) => message.type === "clear")).toBe(true);

  history.pushState({}, "", "/discuss/next");
  await Promise.resolve();
  expect(hookMessages.at(-1)).toBe(false);
  expect(panelMessages.filter((message) => message.type === "clear")).toHaveLength(2);
});
