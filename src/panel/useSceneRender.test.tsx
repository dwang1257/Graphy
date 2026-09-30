import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { parseBinaryTree } from "../core/parse/binaryTree.js";
import { buildTrace, type Trace } from "../core/trace.js";
import { TRACE_SENTINEL } from "../core/traceWire.js";
import type { Pane } from "../core/types.js";
import { DEFAULT_SETTINGS } from "../settings/schema.js";
import { SvgCache, useSceneRender, type SceneRender } from "./useSceneRender.js";

const pending: Array<{ dot: string; resolve: (svg: string) => void }> = [];

vi.mock("./graphviz.js", () => ({
  renderDot: (dot: string) => new Promise<string>((resolve) => pending.push({ dot, resolve })),
}));

const emit = { palette: DEFAULT_SETTINGS.light, layout: DEFAULT_SETTINGS.layout };
const panes: Pane[] = [{ id: "a", title: "root", model: parseBinaryTree([1, 2, 3], "root", "a") }];
const trace: Trace = buildTrace(
  `${TRACE_SENTINEL}0 0 +tz0=9 1<z0 1<- 2<1 2<z0 0<-`,
  panes,
);

let dom: Window;
let container: HTMLDivElement;
let latest: SceneRender | undefined;

function Probe(props: { frameIndex: number }) {
  latest = useSceneRender({ panes, trace, frameIndex: props.frameIndex, emit, styleKey: "s", showTerminal: true, enabled: true });
  return null;
}

async function show(frameIndex: number): Promise<void> {
  await act(async () => {
    render(<Probe frameIndex={frameIndex} />, container);
  });
}

async function finish(index = 0): Promise<string> {
  const job = pending.splice(index, 1)[0]!;
  const svg = `svg:${pending.length}:${job.dot.length}:${Math.random()}`;
  await act(async () => {
    job.resolve(svg);
    await Promise.resolve();
  });
  return svg;
}

async function settleBase(): Promise<string> {
  await act(async () => {
    vi.advanceTimersByTime(200);
  });
  return finish();
}

beforeEach(() => {
  vi.useFakeTimers();
  dom = new Window();
  vi.stubGlobal("window", {
    setTimeout: (fn: () => void, ms: number) => setTimeout(fn, ms),
    clearTimeout: (id: ReturnType<typeof setTimeout>) => clearTimeout(id),
  });
  vi.stubGlobal("document", dom.document);
  container = document.createElement("div") as unknown as HTMLDivElement;
  pending.length = 0;
  latest = undefined;
});

afterEach(() => {
  render(null, container);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SvgCache", () => {
  it("evicts the least recently used layout past the limit", () => {
    const cache = new SvgCache(32);
    for (let i = 0; i < 32; i += 1) cache.set(`k${i}`, `s${i}`);
    cache.get("k0");
    cache.set("k32", "s32");
    expect(cache.size).toBe(32);
    expect(cache.has("k0")).toBe(true);
    expect(cache.has("k1")).toBe(false);
  });
});

describe("useSceneRender", () => {
  it("renders the base layout after a debounce", async () => {
    await show(0);
    expect(latest!.svg).toBe("");
    expect(latest!.baseDot).toContain("digraph");
    expect(pending).toHaveLength(0);
    const base = await settleBase();
    expect(latest!.svg).toBe(base);
    expect(latest!.renderedBaseDot).toBe(latest!.baseDot);
  });

  it("renders the active layout first, then prefetches upcoming ones, holding the previous svg meanwhile", async () => {
    expect(new Set(trace.frames.map((frame) => frame.layoutKey)).size).toBeGreaterThan(4);
    await show(0);
    const base = await settleBase();
    const firstKeys = trace.frames.map((frame) => frame.layoutKey);
    await show(2);
    expect(latest!.svg).toBe(base);
    expect(pending).toHaveLength(1);
    const active = await finish();
    expect(latest!.svg).toBe(active);
    expect(latest!.morphFromSvg).toBeNull();
    const upcoming = new Set(firstKeys.slice(3)).size;
    expect(upcoming).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(3, upcoming); i += 1) {
      expect(pending).toHaveLength(1);
      await finish();
    }
    expect(pending).toHaveLength(0);
  });

  it("offers a morph source only when stepping forward by one frame", async () => {
    await show(0);
    const base = await settleBase();
    await show(1);
    expect(latest!.morphFromSvg).toBeNull();
    await show(2);
    const next = await finish();
    expect(latest!.svg).toBe(next);
    expect(latest!.morphFromSvg).toBe(base);
    while (pending.length > 0) await finish();
    await show(3);
    expect(latest!.morphFromSvg).toBe(next);
    await show(1);
    expect(latest!.morphFromSvg).toBeNull();
  });
});
