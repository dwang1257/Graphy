import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { emitDot } from "../core/dot/emit.js";
import { initialTopology, layoutKeyOf, sceneModel, type SceneTopology } from "../core/scene.js";
import type { Trace } from "../core/trace.js";
import type { Pane } from "../core/types.js";
import type { Layout } from "../settings/schema.js";
import { isEngineReady, layoutNow, loadEngine, renderDot, yieldToMain } from "./graphviz.js";

export const MAX_CACHED_LAYOUTS = 32;
export const PREFETCH_LAYOUTS = 3;

export interface SceneRenderOptions {
  panes: readonly Pane[];
  trace: Trace;
  frameIndex: number;
  layout: Layout;
  showTerminal: boolean;
  enabled: boolean;
}

export interface SceneRender {
  svg: string;
  morphFromSvg: string | null;
  error: string | null;
  baseDot: string;
  renderedBaseDot: string;
}

export class SvgCache {
  private readonly entries = new Map<string, string>();

  constructor(private readonly limit = MAX_CACHED_LAYOUTS) {}

  get size(): number {
    return this.entries.size;
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }

  peek(key: string): string | undefined {
    return this.entries.get(key);
  }

  get(key: string): string | undefined {
    const svg = this.entries.get(key);
    if (svg !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, svg);
    }
    return svg;
  }

  set(key: string, svg: string): void {
    this.entries.delete(key);
    this.entries.set(key, svg);
    while (this.entries.size > this.limit) {
      const oldest = this.entries.keys().next().value;
      if (oldest === undefined) break;
      this.entries.delete(oldest);
    }
  }
}

function dotFor(panes: readonly Pane[], topology: SceneTopology, layout: Layout, showTerminal: boolean): string {
  try {
    return emitDot(sceneModel(panes, topology, { showTerminal }), { layout });
  } catch {
    return "";
  }
}

interface BaseLayout {
  svg: string;
  error: string | null;
}

const NO_LAYOUT: BaseLayout = { svg: "", error: null };

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

function layoutBase(dot: string): BaseLayout {
  try {
    return { svg: layoutNow(dot), error: null };
  } catch (cause) {
    return { svg: "", error: messageOf(cause) };
  }
}

function useEngine(enabled: boolean): { ready: boolean; error: string | null } {
  const [state, setState] = useState(() => ({ ready: isEngineReady(), error: null as string | null }));
  useEffect(() => {
    if (!enabled || state.ready) return;
    let cancelled = false;
    loadEngine().then(
      () => {
        if (!cancelled) setState({ ready: true, error: null });
      },
      (cause: unknown) => {
        if (!cancelled) setState({ ready: false, error: messageOf(cause) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, state.ready]);
  return state;
}

export function useSceneRender(options: SceneRenderOptions): SceneRender {
  const { panes, trace, frameIndex, layout, showTerminal, enabled } = options;
  const base = useMemo(() => initialTopology(panes), [panes]);
  const baseKey = useMemo(() => layoutKeyOf(base), [base]);
  const baseDot = useMemo(
    () => (enabled ? dotFor(panes, base, layout, showTerminal) : ""),
    [enabled, panes, base, layout, showTerminal],
  );

  const engine = useEngine(baseDot !== "");
  const baseLayout = useMemo(
    () => (baseDot && engine.ready ? layoutBase(baseDot) : NO_LAYOUT),
    [baseDot, engine.ready],
  );
  const error = baseDot ? baseLayout.error ?? engine.error : null;
  const ready = baseLayout.svg !== "";

  const { svgs, inflight } = useMemo(
    () => ({ svgs: new SvgCache(), inflight: new Map<string, Promise<string>>() }),
    [baseDot],
  );
  const [, setVersion] = useState(0);
  const lastShown = useRef("");
  const renderedBaseDot = useRef("");
  if (ready) renderedBaseDot.current = baseDot;

  const frames = trace.frames;
  const activeKey = frames[frameIndex]?.layoutKey ?? baseKey;

  useEffect(() => {
    if (!ready) return;
    const wanted = [activeKey];
    for (let i = frameIndex + 1; i < frames.length && wanted.length <= PREFETCH_LAYOUTS; i += 1) {
      const key = frames[i]!.layoutKey;
      if (!wanted.includes(key) && !svgs.has(key)) wanted.push(key);
    }
    const renderKey = (key: string): Promise<string> | undefined => {
      const running = inflight.get(key);
      if (running) return running;
      const topology = frames.find((frame) => frame.layoutKey === key)?.topology;
      const dot = topology ? dotFor(panes, topology, layout, showTerminal) : "";
      if (!dot) return undefined;
      const job = renderDot(dot).then((svg) => {
        svgs.set(key, svg);
        return svg;
      });
      inflight.set(key, job);
      void job.catch(() => undefined).finally(() => inflight.delete(key));
      return job;
    };
    let cancelled = false;
    void (async () => {
      for (const key of wanted) {
        if (cancelled) return;
        if (key === baseKey || svgs.has(key)) continue;
        if (key !== activeKey) {
          await yieldToMain();
          if (cancelled) return;
        }
        try {
          await renderKey(key);
        } catch {
          continue;
        }
        if (cancelled) return;
        setVersion((n) => n + 1);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, activeKey, frameIndex, frames, svgs]);

  const lookup = (key: string, touch: boolean): string | undefined => {
    if (key === baseKey) return baseLayout.svg || undefined;
    return touch ? svgs.get(key) : svgs.peek(key);
  };

  const step = useRef<{ index: number; from: number | null; frames: unknown }>({ index: frameIndex, from: null, frames });
  if (step.current.frames !== frames) step.current = { index: frameIndex, from: null, frames };
  else if (step.current.index !== frameIndex) {
    step.current = { index: frameIndex, from: frameIndex === step.current.index + 1 ? step.current.index : null, frames };
  }

  let svg = "";
  if (baseDot && !error) svg = (ready ? lookup(activeKey, true) : undefined) ?? lastShown.current;
  lastShown.current = svg;

  const from = step.current.from;
  const fromKey = from === null ? undefined : frames[from]?.layoutKey;
  const fromSvg = fromKey === undefined ? undefined : lookup(fromKey, false);
  const morphFromSvg = fromSvg && fromSvg !== svg ? fromSvg : null;

  return { svg, morphFromSvg, error, baseDot, renderedBaseDot: renderedBaseDot.current };
}
