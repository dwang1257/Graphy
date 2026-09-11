import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";

import { clampCaseIndex } from "../core/cases.js";
import { stdoutForCase } from "../core/traceCases.js";
import { buildPanes } from "../core/build.js";
import { emitDot } from "../core/dot/emit.js";
import { parseSignature } from "../core/signature.js";
import { framesFromStdout, type TraceFrame } from "../core/trace.js";
import { canonicalizeLinks, supportsTopologyMorph } from "../core/topology.js";
import { applyTopology } from "../core/treeModel.js";
import { withListAllocs } from "../core/parse/linkedList.js";
import { EMPTY_STAGE_COPY, isEmptyStage, isTooLarge, tooLargeCopy } from "./emptyStage.js";
import { visibleNodeCount, type StructureKind } from "../core/types.js";
import { useStructureKind } from "./useStructureKind.js";
import { DEFAULT_SETTINGS, type Settings } from "../settings/schema.js";
import {
  loadOverrides,
  loadPanelState,
  loadSettings,
  onSettingsChanged,
  saveOverrides,
  saveSettings,
  type Override,
} from "../settings/storage.js";
import { PANEL_CHANNEL, isToPanel, type FromPanel, type Snapshot } from "../shared/protocol.js";

import { SETTINGS_DOT_DEBOUNCE_MS, dotStyleKey } from "./dotStyle.js";
import { GraphView } from "./GraphView.js";
import { SettingsDrawer } from "./SettingsDrawer.js";
import { inkFromDataUrl } from "./imageInk.js";
import { stageBackgroundStyle, stageInkVars } from "./stageBackground.js";
import { TitleBar } from "./TitleBar.js";
import { TracePlayback } from "./TracePlayback.js";
import { preload, renderDot } from "./graphviz.js";
import { detectParentOrigin, isAllowedParentOrigin } from "./parentOrigin.js";

const PARENT_ORIGIN = detectParentOrigin();
const MAX_TOPOLOGY_LAYOUTS = 40;

function frameLayoutKey(frame: TraceFrame): string {
  return `${canonicalizeLinks(frame.links)}#${frame.allocs.map((n) => n.id).join(",")}`;
}

function frameTopoKey(frame: TraceFrame | null | undefined): string {
  return frame && Object.keys(frame.links).length > 0 ? frameLayoutKey(frame) : "";
}

function svgForFrame(
  frame: TraceFrame | null | undefined,
  topologySvgs: Record<string, string>,
  fallback: string,
): string {
  const key = frameTopoKey(frame);
  return (key && topologySvgs[key]) || fallback;
}

function toHost(message: FromPanel): void {
  if (!PARENT_ORIGIN) return;
  parent.postMessage(message, PARENT_ORIGIN);
}

export function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeCase, setActiveCase] = useState(0);
  const [svg, setSvg] = useState("");
  const [topologySvgs, setTopologySvgs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [fitCount, setFitCount] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [traceIndex, setTraceIndex] = useState(0);
  const [tracePlaying, setTracePlaying] = useState(false);
  const [shrunk, setShrunk] = useState(false);
  const [stageImageInk, setStageImageInk] = useState<string | null>(null);
  const prevTraceIndex = useRef(0);

  const liveUpdate = useRef(true);
  liveUpdate.current = settings.liveUpdate;
  const hasRendered = useRef(false);
  const lastSaved = useRef("");
  const saveTimer = useRef<number | undefined>(undefined);
  const lastSlug = useRef("");
  const sawHostShrunk = useRef(false);

  useEffect(() => {
    preload();
    void loadSettings().then(setSettings);
    void loadOverrides().then(setOverrides);
    void loadPanelState().then((state) => {
      if (!sawHostShrunk.current) setShrunk(state.shrunk);
    });
    const stop = onSettingsChanged((incoming) => {
      if (JSON.stringify(incoming) === lastSaved.current) return;
      setSettings(incoming);
    });

    const onMessage = (event: MessageEvent): void => {
      if (event.source !== parent || !isAllowedParentOrigin(event.origin)) return;
      const data: unknown = event.data;
      if (!isToPanel(data)) return;
      if (data.type === "shrunk") {
        sawHostShrunk.current = true;
        setShrunk(data.shrunk);
        return;
      }
      if (data.payload.source === "editor" && !liveUpdate.current && hasRendered.current) return;
      setSnapshot((prev) => {
        const next = data.payload;
        if (next.source !== "editor") return next;
        const stdout = next.stdout ?? prev?.stdout;
        const stdoutByCase = next.stdoutByCase ?? prev?.stdoutByCase;
        if (stdout === next.stdout && stdoutByCase === next.stdoutByCase) return next;
        return { ...next, stdout, stdoutByCase };
      });
    };

    window.addEventListener("message", onMessage);
    toHost({ channel: PANEL_CHANNEL, type: "ready" });
    return () => {
      window.removeEventListener("message", onMessage);
      stop();
    };
  }, []);

  useEffect(() => {
    if (shrunk) setShowSettings(false);
  }, [shrunk]);

  const slug = snapshot?.slug ?? "";
  const cases = snapshot?.cases ?? [];
  const caseIndex = clampCaseIndex(activeCase, cases.length);
  const caseInput = cases[caseIndex] ?? "";

  useEffect(() => {
    if (slug === lastSlug.current) return;
    lastSlug.current = slug;
    setActiveCase(0);
  }, [slug]);

  const override = overrides[slug] ?? {};

  const applyOverride = useCallback((patch: Override) => {
    if (!slug) return;
    setOverrides((prev) => {
      const all = { ...prev, [slug]: { ...prev[slug], ...patch } };
      void saveOverrides(all);
      return all;
    });
  }, [slug]);

  const persistKind = useCallback(
    (kind: StructureKind) => applyOverride({ kind }),
    [applyOverride],
  );
  const { selectedKind, setKind } = useStructureKind(slug, override.kind, persistKind);

  const signature = useMemo(
    () => (snapshot ? parseSignature(snapshot.code, snapshot.lang) : null),
    [snapshot?.code, snapshot?.lang],
  );

  const result = useMemo(() => {
    return buildPanes(caseInput, signature, {
      override: selectedKind,
      showTerminal: settings.layout.showListTerminal,
      showIndices: settings.layout.showMatrixIndices,
    });
  }, [
    caseInput,
    signature,
    selectedKind,
    settings.layout.showListTerminal,
    settings.layout.showMatrixIndices,
  ]);

  const pane = result.panes[0];
  const palette = settings[settings.mode];

  useEffect(() => {
    const url = palette.backgroundImage;
    setStageImageInk(null);
    if (!url) return;
    let cancelled = false;
    void inkFromDataUrl(url).then(
      (ink) => { if (!cancelled) setStageImageInk(ink); },
      () => { if (!cancelled) setStageImageInk(null); },
    );
    return () => { cancelled = true; };
  }, [palette.backgroundImage]);

  const scopedStdout = useMemo(
    () => stdoutForCase(snapshot, caseIndex),
    [snapshot, caseIndex],
  );

  const traceFrames = useMemo(() => {
    if (!pane || !scopedStdout) return [];
    return framesFromStdout(scopedStdout, pane.model);
  }, [pane, scopedStdout]);

  useEffect(() => {
    setTraceIndex(0);
    setTracePlaying(false);
    prevTraceIndex.current = 0;
  }, [scopedStdout, pane?.id, caseIndex]);

  const paneSize = pane ? visibleNodeCount(pane.model) : 0;
  const tooLarge = !!pane && isTooLarge(paneSize);

  const emptyStage = isEmptyStage({
    caseInput,
    nodeCount: paneSize,
    hasFailure: result.failures.length > 0,
  });

  const styleKey = useMemo(
    () => dotStyleKey(palette, settings.layout),
    [palette, settings.layout],
  );
  const [debouncedStyleKey, setDebouncedStyleKey] = useState(styleKey);

  useEffect(() => {
    if (styleKey === debouncedStyleKey) return;
    const timer = window.setTimeout(() => setDebouncedStyleKey(styleKey), SETTINGS_DOT_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [styleKey, debouncedStyleKey]);

  const dot = useMemo(() => {
    if (!pane || tooLarge || emptyStage) return "";
    try {
      return emitDot(pane.model, { palette, layout: settings.layout });
    } catch {
      return "";
    }
  }, [pane, tooLarge, emptyStage, debouncedStyleKey]);

  const topologyKeys = useMemo(() => {
    if (!pane?.model.links || !supportsTopologyMorph(pane.model.kind)) return [] as string[];
    const keys = new Set<string>();
    for (const frame of traceFrames) {
      const key = frameTopoKey(frame);
      if (!key) continue;
      keys.add(key);
      if (keys.size >= MAX_TOPOLOGY_LAYOUTS) break;
    }
    return [...keys];
  }, [pane, traceFrames]);

  useEffect(() => {
    if (!dot) {
      setSvg("");
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      renderDot(dot)
        .then((out) => {
          if (cancelled) return;
          hasRendered.current = true;
          setError(null);
          setSvg(out);
        })
        .catch((cause: unknown) => {
          if (cancelled) return;
          setError(cause instanceof Error ? cause.message : String(cause));
          setSvg("");
        });
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [dot]);

  useEffect(() => {
    if (!pane || tooLarge || emptyStage || topologyKeys.length === 0) {
      setTopologySvgs({});
      return;
    }
    let cancelled = false;
    const options = { palette, layout: settings.layout };
    void (async () => {
      const next: Record<string, string> = {};
      for (const key of topologyKeys) {
        if (cancelled) return;
        try {
          const frame = traceFrames.find((f) => frameLayoutKey(f) === key);
          if (!frame) continue;
          const model = applyTopology(withListAllocs(pane.model, frame.allocs), frame.links);
          next[key] = await renderDot(emitDot(model, options));
        } catch {
        }
      }
      if (!cancelled) setTopologySvgs(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [pane, tooLarge, emptyStage, topologyKeys, debouncedStyleKey, traceFrames, palette, settings.layout]);

  const activeFrame = traceFrames[traceIndex] ?? null;
  const displaySvg = svgForFrame(activeFrame, topologySvgs, svg);
  const prevFrame = traceIndex > 0 ? traceFrames[traceIndex - 1] : null;
  const morphFromSvg = prevFrame ? svgForFrame(prevFrame, topologySvgs, svg) : null;

  const steppedForward = traceIndex === prevTraceIndex.current + 1;
  useEffect(() => {
    prevTraceIndex.current = traceIndex;
  }, [traceIndex]);

  const shouldMorph =
    steppedForward &&
    !!morphFromSvg &&
    !!displaySvg &&
    morphFromSvg !== displaySvg &&
    topologyKeys.length > 0 &&
    topologyKeys.length <= MAX_TOPOLOGY_LAYOUTS;

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      lastSaved.current = JSON.stringify(next);
      void saveSettings(next);
    }, 300);
  }, []);

  const stageStyle = useMemo(
    () => stageBackgroundStyle(palette.background, palette.backgroundImage),
    [palette.background, palette.backgroundImage],
  );
  const panelStyle = useMemo(
    () => ({ "--stage-bg": palette.background, ...stageInkVars(palette.background, stageImageInk) }) as JSX.CSSProperties,
    [palette.background, stageImageInk],
  );

  return (
    <div
      class={`panel${settings.mode === "dark" ? " dark" : ""}${shrunk ? " is-shrunk" : ""}`}
      style={panelStyle}
    >
      <TitleBar
        showSettings={showSettings}
        selectedKind={selectedKind}
        onKindChange={setKind}
        onFit={() => setFitCount((n) => n + 1)}
        onToggleSettings={() => {
          if (shrunk) {
            toHost({ channel: PANEL_CHANNEL, type: "setShrunk", shrunk: false });
            setShowSettings(true);
            return;
          }
          setShowSettings((v) => !v);
        }}
        onClose={() => toHost({ channel: PANEL_CHANNEL, type: "close" })}
        shrunk={shrunk}
        onToggleShrunk={() => {
          toHost({ channel: PANEL_CHANNEL, type: "setShrunk", shrunk: !shrunk });
        }}
        onDrag={(dx, dy) => toHost({ channel: PANEL_CHANNEL, type: "move", dx, dy })}
        onDragEnd={() => toHost({ channel: PANEL_CHANNEL, type: "persist" })}
      />

      <div class="stage-wrap">
        {showSettings && (
          <SettingsDrawer
            settings={settings}
            activePalette={settings.mode}
            onChange={updateSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
        <div class="stage-area" style={stageStyle}>
          {displaySvg ? (
            <GraphView
              svg={displaySvg}
              fitKey={`${slug}:${caseIndex}:${pane?.id ?? ""}:${fitCount}`}
              nodeBackgroundImage={palette.nodeBackgroundImage}
              traceFrame={activeFrame}
              morphFromSvg={shouldMorph ? morphFromSvg : null}
              morph={shouldMorph}
            />
          ) : (
            <>
              <div class="stage" />
              <Placeholder
                snapshot={snapshot}
                error={error}
                tooLarge={tooLarge}
                nodeCount={paneSize}
                emptyStage={emptyStage}
                failure={result.failures[0]?.reason}
              />
            </>
          )}
        </div>
      </div>

      {(cases.length > 1 || traceFrames.length > 0) && (
        <div class="statusbar">
          {cases.length > 1 && (
            <div class="case-switcher" role="tablist" aria-label="Test cases">
              {cases.map((_, i) => (
                <button
                  class="case-pill"
                  role="tab"
                  key={i}
                  type="button"
                  aria-selected={i === caseIndex}
                  aria-label={`Case ${i + 1}`}
                  onClick={() => setActiveCase(i)}
                >
                  Case {i + 1}
                </button>
              ))}
            </div>
          )}
          <TracePlayback
            frames={traceFrames}
            index={traceIndex}
            playing={tracePlaying}
            onIndexChange={setTraceIndex}
            onPlayingChange={setTracePlaying}
          />
        </div>
      )}
    </div>
  );
}

interface PlaceholderProps {
  snapshot: Snapshot | null;
  error: string | null;
  tooLarge: boolean;
  nodeCount: number;
  emptyStage: boolean;
  failure: string | undefined;
}

function Placeholder(props: PlaceholderProps): JSX.Element {
  if (props.error) {
    return (
      <div class="placeholder error">
        <p>Layout failed. Graphviz could not lay this out.</p>
        <code>{props.error}</code>
      </div>
    );
  }

  let message = props.failure ?? "This input does not look like a graph structure.";
  let error = false;
  if (props.snapshot?.captureError) {
    message = `Case split failed. ${props.snapshot.captureError}`;
    error = true;
  } else if (props.tooLarge) {
    message = tooLargeCopy(props.nodeCount);
    error = true;
  } else if (props.emptyStage) {
    message = EMPTY_STAGE_COPY;
  }

  return (
    <div class={error ? "placeholder error" : "placeholder"}>
      <p>{message}</p>
    </div>
  );
}
