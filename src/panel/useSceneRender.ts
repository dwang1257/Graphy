import { useEffect, useMemo, useRef, useState } from "preact/hooks";

import { emitDot, type EmitOptions } from "../core/dot/emit.js";
import { initialTopology, layoutKeyOf, sceneModel, type SceneTopology } from "../core/scene.js";
import type { Trace } from "../core/trace.js";
import type { Pane } from "../core/types.js";
import { renderDot } from "./graphviz.js";

export const MAX_CACHED_LAYOUTS = 32;
export const PREFETCH_LAYOUTS = 3;
export const BASE_RENDER_DELAY_MS = 120;

export interface SceneRenderOptions {
  panes: readonly Pane[];
  trace: Trace;
  frameIndex: number;
  emit: EmitOptions;
  styleKey: string;
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

function dotFor(panes: readonly Pane[], topology: SceneTopology, emit: EmitOptions, showTerminal: boolean): string {
  try {
    return emitDot(sceneModel(panes, topology, { showTerminal }), emit);
  } catch {
    return "";
  }
}

interface Rendered {
  dot: string;
  svg: string;
}

const NONE: Rendered = { dot: "", svg: "" };

export function useSceneRender(options: SceneRenderOptions): SceneRender {
  const { panes, trace, frameIndex, emit, styleKey, showTerminal, enabled } = options;
  const base = useMemo(() => initialTopology(panes), [panes]);
  const baseKey = useMemo(() => layoutKeyOf(base), [base]);
  const baseDot = useMemo(
    () => (enabled ? dotFor(panes, base, emit, showTerminal) : ""),
    [enabled, panes, base, showTerminal, styleKey],
  );

  const cache = useRef({ owner: "", svgs: new SvgCache(), inflight: new Map<string, Promise<string>>() });
  if (cache.current.owner !== baseDot) cache.current = { owner: baseDot, svgs: new SvgCache(), inflight: new Map() };
  const { svgs, inflight } = cache.current;

  const [renderedBase, setRenderedBase] = useState<Rendered>(NONE);
  const [error, setError] = useState<string | null>(null);
  const [, setVersion] = useState(0);
  const lastShown = useRef("");

  useEffect(() => {
    setError(null);
    if (!baseDot) {
      setRenderedBase(NONE);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      renderDot(baseDot)
        .then((svg) => {
          if (cancelled) return;
          svgs.set(baseKey, svg);
          setRenderedBase({ dot: baseDot, svg });
        })
        .catch((cause: unknown) => {
          if (cancelled) return;
          setError(cause instanceof Error ? cause.message : String(cause));
          setRenderedBase(NONE);
        });
    }, BASE_RENDER_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [baseDot]);

  const frames = trace.frames;
  const activeKey = frames[frameIndex]?.layoutKey ?? baseKey;
  const ready = baseDot !== "" && renderedBase.dot === baseDot;

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
      const topology = key === baseKey ? base : frames.find((frame) => frame.layoutKey === key)?.topology;
      const dot = topology ? dotFor(panes, topology, emit, showTerminal) : "";
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
        if (svgs.has(key)) continue;
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

  const step = useRef<{ index: number; from: number | null; frames: unknown }>({ index: frameIndex, from: null, frames });
  if (step.current.frames !== frames) step.current = { index: frameIndex, from: null, frames };
  else if (step.current.index !== frameIndex) {
    step.current = { index: frameIndex, from: frameIndex === step.current.index + 1 ? step.current.index : null, frames };
  }

  let svg = "";
  if (baseDot && !error) svg = (ready ? svgs.get(activeKey) : undefined) ?? lastShown.current;
  lastShown.current = svg;

  const from = step.current.from;
  const fromKey = from === null ? undefined : frames[from]?.layoutKey;
  const fromSvg = fromKey === undefined ? undefined : svgs.peek(fromKey);
  const morphFromSvg = fromSvg && fromSvg !== svg ? fromSvg : null;

  return { svg, morphFromSvg, error, baseDot, renderedBaseDot: renderedBase.dot };
}
