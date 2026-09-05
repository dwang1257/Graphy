import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";

import { clampCaseIndex } from "../core/cases.js";
import { buildPanes } from "../core/build.js";
import { emitDot } from "../core/dot/emit.js";
import { parseSignature } from "../core/signature.js";
import { framesFromStdout } from "../core/trace.js";
import { KIND_LABELS, visibleNodeCount, type StructureKind } from "../core/types.js";
import { DEFAULT_SETTINGS, type Settings } from "../settings/schema.js";
import {
  loadOverrides,
  loadSettings,
  onSettingsChanged,
  saveOverrides,
  saveSettings,
  type Override,
} from "../settings/storage.js";
import { PANEL_CHANNEL, isToPanel, type FromPanel, type Snapshot } from "../shared/protocol.js";

import { GraphView } from "./GraphView.js";
import { SettingsDrawer } from "./SettingsDrawer.js";
import { TitleBar } from "./TitleBar.js";
import { TracePlayback } from "./TracePlayback.js";
import { preload, renderDot } from "./graphviz.js";
import { detectParentOrigin, isAllowedParentOrigin } from "./parentOrigin.js";

const PARENT_ORIGIN = detectParentOrigin();

function toHost(message: FromPanel): void {
  if (!PARENT_ORIGIN) return;
  parent.postMessage(message, PARENT_ORIGIN);
}

function asStructureKind(value: string | undefined): StructureKind | undefined {
  if (value && value in KIND_LABELS) return value as StructureKind;
  return undefined;
}

function resolvedPalette(mode: Settings["mode"]): "light" | "dark" {
  return mode === "light" ? "light" : "dark";
}

export function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeCase, setActiveCase] = useState(0);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  const [fitCount, setFitCount] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [traceIndex, setTraceIndex] = useState(0);
  const [tracePlaying, setTracePlaying] = useState(false);

  const liveUpdate = useRef(true);
  liveUpdate.current = settings.liveUpdate;
  const hasRendered = useRef(false);
  const lastSaved = useRef("");
  const saveTimer = useRef<number | undefined>(undefined);
  const lastSlug = useRef("");

  useEffect(() => {
    preload();
    void loadSettings().then(setSettings);
    void loadOverrides().then(setOverrides);
    const stop = onSettingsChanged((incoming) => {
      // Skip the echo of this panel's own debounced write.
      if (JSON.stringify(incoming) === lastSaved.current) return;
      setSettings(incoming);
    });

    const onMessage = (event: MessageEvent): void => {
      if (event.source !== parent || !isAllowedParentOrigin(event.origin)) return;
      const data: unknown = event.data;
      if (!isToPanel(data)) return;
      if (data.type === "theme") return;
      // With live updates off, only a Run refreshes the view.
      if (data.payload.source === "editor" && !liveUpdate.current && hasRendered.current) return;
      setSnapshot((prev) => {
        const next = data.payload;
        // Keep the last Run's stdout across editor keystrokes so the scrubber survives typing.
        if (next.source === "editor" && next.stdout === undefined && prev?.stdout) {
          return { ...next, stdout: prev.stdout };
        }
        return next;
      });
    };

    window.addEventListener("message", onMessage);
    toHost({ channel: PANEL_CHANNEL, type: "ready" });
    return () => {
      window.removeEventListener("message", onMessage);
      stop();
    };
  }, []);

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
  const selectedKind = asStructureKind(override.kind);

  const signature = useMemo(
    () => (snapshot ? parseSignature(snapshot.code, snapshot.lang) : null),
    [snapshot?.code, snapshot?.lang],
  );

  const result = useMemo(() => {
    if (!selectedKind) {
      return {
        panes: [],
        failures: caseInput.trim()
          ? [{ paramName: "input", reason: "Choose a structure in the title bar to draw this input." }]
          : [],
      };
    }
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

  // One graph per Case: first visualizable parameter of the selected case.
  const pane = result.panes[0];
  const paletteName = resolvedPalette(settings.mode);
  const palette = settings[paletteName];

  const traceFrames = useMemo(() => {
    if (!pane || !snapshot?.stdout) return [];
    return framesFromStdout(snapshot.stdout, pane.model);
  }, [pane, snapshot?.stdout]);

  useEffect(() => {
    setTraceIndex(0);
    setTracePlaying(false);
  }, [snapshot?.stdout, pane?.id, caseIndex]);

  const paneSize = pane ? visibleNodeCount(pane.model) : 0;
  const confirmKey = `${slug}:${caseIndex}:${caseInput}:${selectedKind ?? ""}`;
  const tooLarge = !!pane && paneSize > settings.nodeLimit && confirmedFor !== confirmKey;

  const dot = useMemo(() => {
    if (!pane || tooLarge) return "";
    try {
      return emitDot(pane.model, { palette, layout: settings.layout });
    } catch {
      return "";
    }
  }, [pane, tooLarge, palette, settings.layout]);

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

  const applyOverride = useCallback((patch: Override) => {
    if (!slug) return;
    setOverrides((prev) => {
      const all = { ...prev, [slug]: { ...prev[slug], ...patch } };
      void saveOverrides(all);
      return all;
    });
  }, [slug]);

  const setKind = useCallback(
    (kind: StructureKind) => applyOverride({ kind }),
    [applyOverride],
  );

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      lastSaved.current = JSON.stringify(next);
      void saveSettings(next);
    }, 300);
  }, []);

  const stageStyle = useMemo((): JSX.CSSProperties => {
    const style: JSX.CSSProperties = { backgroundColor: palette.background };
    if (palette.backgroundImage) {
      style.backgroundImage = `url(${palette.backgroundImage})`;
      style.backgroundSize = "cover";
      style.backgroundPosition = "center";
      style.backgroundRepeat = "no-repeat";
    }
    return style;
  }, [palette.background, palette.backgroundImage]);

  return (
    <div class={`panel${paletteName === "dark" ? " dark" : ""}`}>
      <TitleBar
        showSettings={showSettings}
        selectedKind={selectedKind}
        onKindChange={setKind}
        onFit={() => setFitCount((n) => n + 1)}
        onToggleSettings={() => setShowSettings((v) => !v)}
        onClose={() => toHost({ channel: PANEL_CHANNEL, type: "close" })}
        onDrag={(dx, dy) => toHost({ channel: PANEL_CHANNEL, type: "move", dx, dy })}
        onDragEnd={() => toHost({ channel: PANEL_CHANNEL, type: "persist" })}
      />

      <div class="stage-wrap">
        {showSettings && (
          <SettingsDrawer
            settings={settings}
            activePalette={paletteName}
            onChange={updateSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
        <div class="stage-area stage-bg" style={stageStyle}>
          {svg ? (
            <GraphView
              svg={svg}
              fitKey={`${slug}:${caseIndex}:${pane?.id ?? ""}:${fitCount}`}
              nodeBackgroundImage={palette.nodeBackgroundImage}
              traceFrame={traceFrames[traceIndex] ?? null}
            />
          ) : (
            <div class="stage" />
          )}
          {!svg && (
            <Placeholder
              snapshot={snapshot}
              caseInput={caseInput}
              error={error}
              tooLarge={tooLarge}
              nodeCount={paneSize}
              failure={result.failures[0]?.reason}
              onConfirmLarge={() => setConfirmedFor(confirmKey)}
            />
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
  caseInput: string;
  error: string | null;
  tooLarge: boolean;
  nodeCount: number;
  failure: string | undefined;
  onConfirmLarge: () => void;
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
  if (props.snapshot?.captureError) {
    return (
      <div class="placeholder error">
        <p>Case split failed. {props.snapshot.captureError}</p>
      </div>
    );
  }
  if (props.tooLarge) {
    return (
      <div class="placeholder">
        <p>{props.nodeCount} nodes. Large graphs can take a moment to lay out.</p>
        <button type="button" class="btn btn-primary" onClick={props.onConfirmLarge}>Render anyway</button>
      </div>
    );
  }
  if (!props.snapshot || !props.caseInput.trim()) {
    return (
      <div class="placeholder">
        <p>no test case, hit run</p>
      </div>
    );
  }
  return (
    <div class="placeholder">
      <p>{props.failure ?? "This input does not look like a graph structure."}</p>
    </div>
  );
}
