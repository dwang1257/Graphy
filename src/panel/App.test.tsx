import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, type Settings } from "../settings/schema.js";

type Update = (prev: Settings) => Settings;

const harness = vi.hoisted(() => ({
  resolveLoad: undefined as ((settings: unknown) => void) | undefined,
  remote: undefined as ((update: Update) => void) | undefined,
  saves: [] as unknown[],
  drawer: [] as Array<Record<string, unknown>>,
  titleBar: [] as Array<Record<string, unknown>>,
}));

vi.mock("./graphviz.js", () => ({
  preload: () => undefined,
  isEngineReady: () => true,
  loadEngine: () => Promise.resolve(),
  layoutNow: (dot: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><desc>${dot.length}</desc></svg>`,
  renderDot: () => new Promise(() => undefined),
  yieldToMain: () => Promise.resolve(),
}));

vi.mock("./parentOrigin.js", () => ({
  detectParentOrigin: () => null,
  isAllowedParentOrigin: () => false,
}));

vi.mock("./imageUpload.js", () => ({
  compactSettingsImages: (settings: unknown) => Promise.resolve(settings),
}));

vi.mock("../settings/storage.js", () => ({
  loadSettings: () => new Promise((resolve) => {
    harness.resolveLoad = resolve;
  }),
  loadOverrides: () => Promise.resolve({}),
  loadPanelState: () => Promise.resolve({ shrunk: false }),
  onSettingsChanged: (handler: (update: Update) => void) => {
    harness.remote = handler;
    return () => undefined;
  },
  saveOverrides: () => Promise.resolve(),
  saveSettings: (settings: unknown) => {
    harness.saves.push(settings);
    return Promise.resolve();
  },
  withOverrideKind: (all: unknown) => all,
}));

vi.mock("./SettingsDrawer.js", () => ({
  SettingsDrawer: (props: Record<string, unknown>) => {
    harness.drawer.push(props);
    return null;
  },
}));

vi.mock("./TitleBar.js", () => ({
  TitleBar: (props: Record<string, unknown>) => {
    harness.titleBar.push(props);
    return null;
  },
}));

const { App, SETTINGS_SAVE_DELAY_MS } = await import("./App.js");

let dom: Window;
let container: HTMLDivElement;

const LIGHT: Settings = { ...DEFAULT_SETTINGS, mode: "light" };

async function mount(): Promise<void> {
  await act(async () => {
    render(<App />, container);
  });
}

async function load(settings: Settings): Promise<void> {
  await act(async () => {
    harness.resolveLoad?.(settings);
    await Promise.resolve();
  });
}

function lastDrawer(): { settings: Settings; onChange: (update: Settings | Update) => void; onClose: () => void } {
  return harness.drawer.at(-1) as never;
}

async function openDrawer(): Promise<void> {
  await act(async () => {
    (harness.titleBar.at(-1)!.onToggleSettings as () => void)();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  dom = new Window();
  Object.assign(dom, { setTimeout, clearTimeout });
  vi.stubGlobal("window", dom);
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("parent", dom);
  vi.stubGlobal("ResizeObserver", class {
    observe(): void {}
    disconnect(): void {}
  });
  container = document.createElement("div") as unknown as HTMLDivElement;
  document.body.append(container as unknown as Node);
  harness.resolveLoad = undefined;
  harness.remote = undefined;
  harness.saves.length = 0;
  harness.drawer.length = 0;
  harness.titleBar.length = 0;
});

afterEach(() => {
  render(null, container);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("App settings", () => {
  it("holds the first paint until stored settings load", async () => {
    await mount();
    expect(container.innerHTML).toBe("");
    await load(LIGHT);
    const panel = container.querySelector(".panel");
    expect(panel).not.toBeNull();
    expect(panel?.classList.contains("dark")).toBe(false);
  });

  it("applies updater changes synchronously through a stable callback and saves once after the burst", async () => {
    await mount();
    await load(LIGHT);
    await openDrawer();
    const onChange = lastDrawer().onChange;
    const onClose = lastDrawer().onClose;

    await act(async () => {
      onChange((prev) => ({ ...prev, light: { ...prev.light, nodeFill: "#111111" } }));
      onChange((prev) => ({ ...prev, light: { ...prev.light, edgeColor: "#222222" } }));
    });
    expect(lastDrawer().settings.light.nodeFill).toBe("#111111");
    expect(lastDrawer().settings.light.edgeColor).toBe("#222222");
    expect(lastDrawer().onChange).toBe(onChange);
    expect(lastDrawer().onClose).toBe(onClose);
    expect(harness.saves).toHaveLength(0);

    vi.advanceTimersByTime(SETTINGS_SAVE_DELAY_MS);
    expect(harness.saves).toHaveLength(1);
    expect((harness.saves[0] as Settings).light.edgeColor).toBe("#222222");
  });

  it("flushes a pending save when the page is hidden", async () => {
    await mount();
    await load(LIGHT);
    await openDrawer();
    await act(async () => {
      lastDrawer().onChange((prev) => ({ ...prev, mode: "dark" }));
    });
    window.dispatchEvent(new dom.Event("pagehide") as unknown as Event);
    expect(harness.saves).toHaveLength(1);
    vi.advanceTimersByTime(SETTINGS_SAVE_DELAY_MS);
    expect(harness.saves).toHaveLength(1);
  });

  it("keeps title bar callbacks stable across settings changes", async () => {
    await mount();
    await load(LIGHT);
    await openDrawer();
    const before = harness.titleBar.at(-1)!;
    await act(async () => {
      lastDrawer().onChange((prev) => ({ ...prev, mode: "dark" }));
    });
    const after = harness.titleBar.at(-1)!;
    for (const key of ["onFit", "onToggleSettings", "onClose", "onToggleShrunk", "onDrag", "onDragEnd", "onKindChange"]) {
      expect(after[key]).toBe(before[key]);
    }
    expect(container.querySelector(".panel")?.classList.contains("dark")).toBe(true);
  });

  it("ignores remote changes that match the current settings and applies real ones", async () => {
    await mount();
    await load(LIGHT);
    await openDrawer();
    const renders = harness.drawer.length;
    await act(async () => {
      harness.remote?.((prev) => ({ ...prev, light: { ...prev.light } }));
    });
    expect(harness.drawer.length).toBe(renders);
    await act(async () => {
      harness.remote?.((prev) => ({ ...prev, light: { ...prev.light, nodeFill: "#abcdef" } }));
    });
    expect(lastDrawer().settings.light.nodeFill).toBe("#abcdef");
    expect(harness.saves).toHaveLength(0);
  });
});
