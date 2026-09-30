import { afterEach, expect, test, vi } from "vitest";

const pageMessages: string[] = [];
const panelMessages: Array<{ channel: string; type: string }> = [];
const scripts: Array<{ src: string; fireLoad(): void }> = [];

const hosts: FakePanelHost[] = [];

class FakePanelHost {
  restored = Promise.resolve();
  isOpen = false;
  private readonly onOpenChange?: (open: boolean) => void;

  constructor(_url: string, options: { onOpenChange?: (open: boolean) => void } = {}) {
    this.onOpenChange = options.onOpenChange;
    hosts.push(this);
  }

  open(): void {
    this.isOpen = true;
    this.onOpenChange?.(true);
  }

  close(): void {
    this.isOpen = false;
    this.onOpenChange?.(false);
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  destroy(): void {}

  send(message: { channel: string; type: string }): void {
    if (!this.isOpen && message.type === "snapshot") return;
    panelMessages.push(message);
  }
}

vi.mock("./host.js", () => ({ PanelHost: FakePanelHost }));
vi.mock("./pageTrace.js", () => ({
  notifyPageHooks: (enabled: boolean) => pageMessages.push(`hooks:${enabled}`),
  notifyPageTrace: (enabled: boolean) => pageMessages.push(`trace:${enabled}`),
}));
vi.mock("../settings/storage.js", () => ({
  loadAutoOpen: () => Promise.resolve(false),
}));

function fakeNavigation(locationState: { pathname: string }) {
  const listeners: Array<() => void> = [];
  return {
    addEventListener: (type: string, listener: () => void) => {
      if (type === "currententrychange") listeners.push(listener);
    },
    go: (path: string) => {
      locationState.pathname = path;
      for (const listener of listeners) listener();
    },
  };
}

afterEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
  pageMessages.length = 0;
  panelMessages.length = 0;
  scripts.length = 0;
  hosts.length = 0;
});

function installContentPage(pathname: string) {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const locationState = { pathname, origin: "https://leetcode.com" };
  const navigationState = fakeNavigation(locationState);
  const fakeWindow = {
    addEventListener: (type: string, listener: (...args: unknown[]) => void) => {
      const entries = listeners.get(type) ?? [];
      entries.push(listener);
      listeners.set(type, entries);
    },
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

  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("location", locationState);
  vi.stubGlobal("navigation", navigationState);
  vi.stubGlobal("chrome", {
    runtime: {
      getURL: (path: string) => `chrome-extension://graphy/${path}`,
      onMessage: { addListener: () => undefined },
    },
  });
  return { listeners, navigationState, fakeWindow };
}

test("enables tracing and hooks once the lazily injected page script loads on first open", async () => {
  installContentPage("/problems/first/");
  await import("./index.js");
  await Promise.resolve();
  expect(scripts).toHaveLength(0);

  hosts[0]?.open();
  expect(scripts).toHaveLength(1);
  expect(pageMessages).toEqual([]);

  scripts[0]?.fireLoad();
  expect(pageMessages).toEqual(["trace:true", "hooks:true"]);

  hosts[0]?.close();
  expect(pageMessages).toEqual(["trace:true", "hooks:true", "trace:false", "hooks:false"]);

  hosts[0]?.open();
  expect(scripts).toHaveLength(1);
  expect(pageMessages.slice(-2)).toEqual(["trace:true", "hooks:true"]);
});

test("sends the latest desired state when the page script finishes loading after the panel closed", async () => {
  installContentPage("/problems/first/");
  await import("./index.js");
  await Promise.resolve();

  hosts[0]?.open();
  hosts[0]?.close();
  expect(pageMessages).toEqual([]);

  scripts[0]?.fireLoad();
  expect(pageMessages).toEqual(["trace:false", "hooks:false"]);
});

test("injects once on problem entry, toggles hooks across SPA navigation, and clears the panel", async () => {
  const { listeners, navigationState, fakeWindow } = installContentPage("/discuss/example");

  await import("./index.js");
  expect(scripts).toHaveLength(0);
  expect(pageMessages).toEqual([]);

  navigationState.go("/problems/first");
  await Promise.resolve();
  expect(scripts).toHaveLength(0);
  expect(pageMessages).toEqual([]);

  hosts[0]?.open();
  expect(scripts).toHaveLength(1);
  scripts[0]?.fireLoad();
  expect(pageMessages).toEqual(["trace:true", "hooks:true"]);

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

  const snapshot = {
    cases: ["[1]"],
    code: "",
    lang: "cpp",
    slug: "first",
    source: "editor",
    at: 1,
  };
  for (const listener of listeners.get("message") ?? []) {
    listener({ source: fakeWindow, origin: "https://leetcode.com", data: { channel: "graphy:page", type: "snapshot", payload: snapshot } });
  }
  expect(panelMessages.filter((message) => message.type === "snapshot")).toHaveLength(1);

  navigationState.go("/problems/first/editorial/");
  await Promise.resolve();
  expect(pageMessages.length).toBeGreaterThan(2);
  expect(pageMessages.filter((message) => message.endsWith(":false"))).toEqual([]);
  expect(panelMessages.some((message) => message.type === "clear")).toBe(false);

  navigationState.go("/problems/second");
  await Promise.resolve();
  expect(scripts).toHaveLength(1);
  expect(pageMessages.filter((message) => message.endsWith(":false"))).toEqual([]);
  expect(panelMessages.some((message) => message.type === "clear")).toBe(false);

  for (const listener of listeners.get("message") ?? []) {
    listener({ source: fakeWindow, origin: "https://leetcode.com", data: { channel: "graphy:page", type: "clear" } });
  }
  expect(panelMessages.filter((message) => message.type === "clear")).toHaveLength(1);

  navigationState.go("/discuss/next");
  await Promise.resolve();
  expect(pageMessages.slice(-2)).toEqual(["trace:false", "hooks:false"]);
  expect(panelMessages.filter((message) => message.type === "clear")).toHaveLength(2);
});

test("does not forward page snapshots while the panel is closed", async () => {
  const { listeners, fakeWindow } = installContentPage("/problems/first/");

  await import("./index.js");
  const payload = { cases: ["[1]"], code: "", lang: "cpp", slug: "first", source: "editor", at: 1 };
  for (const listener of listeners.get("message") ?? []) {
    listener({ source: fakeWindow, origin: "https://leetcode.com", data: { channel: "graphy:page", type: "snapshot", payload } });
  }
  expect(panelMessages).toEqual([]);
});
