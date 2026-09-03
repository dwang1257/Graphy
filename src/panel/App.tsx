import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";

import { clampCaseIndex } from "../core/cases.js";
import { buildPanes } from "../core/build.js";
import { emitDot } from "../core/dot/emit.js";
import { parseSignature } from "../core/signature.js";
import { visibleNodeCount, type GraphModel, type StructureKind } from "../core/types.js";
import { DEFAULT_SETTINGS, type Settings } from "../settings/schema.js";
import {
  loadOverrides,
  loadSettings,
  onSettingsChanged,
  saveSettings,
  type Override,
} from "../settings/storage.js";
import { PANEL_CHANNEL, isToPanel, type FromPanel, type Snapshot } from "../shared/protocol.js";

import { GraphView } from "./GraphView.js";
import { pointerDragHandler } from "./usePointerDrag.js";
import { SettingsDrawer } from "./SettingsDrawer.js";
import { TitleBar } from "./TitleBar.js";
import { GripIcon } from "./icons.js";
import { preload, renderDot } from "./graphviz.js";
import { detectParentOrigin, isAllowedParentOrigin } from "./parentOrigin.js";

const PARENT_ORIGIN = detectParentOrigin();

function toHost(message: FromPanel): void {
  if (!PARENT_ORIGIN) return;
  parent.postMessage(message, PARENT_ORIGIN);
}

function resolvedPalette(mode: Settings["mode"], pageIsDark: boolean): "light" | "dark" {
  if (mode === "light" || mode === "dark") return mode;
  return pageIsDark ? "dark" : "light";
}

export function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [pageIsDark, setPageIsDark] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeCase, setActiveCase] = useState(0);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  const [fitCount, setFitCount] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [localInput, setLocalInput] = useState<string | null>(null);

  const liveUpdate = useRef(true);
  const inputFocused = useRef(false);
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
      if (data.type === "theme") {
        setPageIsDark(data.pageIsDark);
        return;
      }
      // With live updates off, only a Run refreshes the view.
      if (data.payload.source === "editor" && !liveUpdate.current && hasRendered.current) return;
      setPageIsDark(data.pageIsDark);
      setSnapshot(data.payload);
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
  const capturedInput = cases[caseIndex] ?? "";
  const caseInput = localInput ?? capturedInput;

  useEffect(() => {
    if (slug === lastSlug.current) return;
    lastSlug.current = slug;
    setActiveCase(0);
    setLocalInput(null);
  }, [slug]);

  useEffect(() => {
    setLocalInput(null);
  }, [caseIndex]);

  useEffect(() => {
    if (!inputFocused.current) setLocalInput(null);
  }, [capturedInput]);

  const override = overrides[slug] ?? {};
  const overrideKind = (override.kind as StructureKind | undefined) ?? "auto";

  const signature = useMemo(
    () => (snapshot ? parseSignature(snapshot.code, snapshot.lang) : null),
    [snapshot?.code, snapshot?.lang],
  );

  const result = useMemo(
    () =>
      buildPanes(caseInput, signature, {
        override: overrideKind === "auto" ? undefined : overrideKind,
        directedOverride: override.directed,
        showTerminal: settings.layout.showListTerminal,
        showIndices: settings.layout.showMatrixIndices,
      }),
    [
      caseInput,
      signature,
      overrideKind,
      override.directed,
      settings.layout.showListTerminal,
      settings.layout.showMatrixIndices,
    ],
  );

  // One graph per Case: first visualizable parameter of the selected case.
  const pane = result.panes[0];
  const paletteName = resolvedPalette(settings.mode, pageIsDark);
  const palette = settings[paletteName];

  const paneSize = pane ? visibleNodeCount(pane.model) : 0;
  const confirmKey = `${slug}:${caseIndex}:${caseInput}:${overrideKind}`;
  const tooLarge = !!pane && paneSize > settings.nodeLimit && confirmedFor !== confirmKey;
  const emptyStructure = !!pane && paneSize === 0 && !tooLarge;

  const dot = useMemo(() => {
    if (!pane || tooLarge || emptyStructure) return "";
    try {
      return emitDot(pane.model, { palette, layout: settings.layout });
    } catch {
      return "";
    }
  }, [pane, tooLarge, emptyStructure, palette, settings.layout]);

  useEffect(() => {
    if (!dot) {
      setSvg("");
      setError(null);
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

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      lastSaved.current = JSON.stringify(next);
      void saveSettings(next);
    }, 300);
  }, []);

  const onResizeGrip = pointerDragHandler<HTMLSpanElement>({
    onMove: (dx, dy) => toHost({ channel: PANEL_CHANNEL, type: "resize", dx, dy }),
    onEnd: () => toHost({ channel: PANEL_CHANNEL, type: "persist" }),
  });

  const stageStyle = useMemo((): JSX.CSSProperties => {
    const style: JSX.CSSProperties = { backgroundColor: palette.background };
    if (palette.backgroundImage) {
      style.backgroundImage = `url(${palette.backgroundImage})`;
      style.backgroundSize = "contain";
      style.backgroundPosition = "center";
      style.backgroundRepeat = "no-repeat";
    }
    return style;
  }, [palette.background, palette.backgroundImage]);

  return (
    <div class={`panel${paletteName === "dark" ? " dark" : ""}`}>
      <TitleBar
        collapsed={collapsed}
        showSettings={showSettings}
        onFit={() => setFitCount((n) => n + 1)}
        onToggleSettings={() => setShowSettings((v) => !v)}
        onCollapse={() => {
          const next = !collapsed;
          setCollapsed(next);
          toHost({ channel: PANEL_CHANNEL, type: "collapse", collapsed: next });
        }}
        onClose={() => toHost({ channel: PANEL_CHANNEL, type: "close" })}
        onDrag={(dx, dy) => toHost({ channel: PANEL_CHANNEL, type: "move", dx, dy })}
        onDragEnd={() => toHost({ channel: PANEL_CHANNEL, type: "persist" })}
      />

      {!collapsed && (
        <>
          <div class={`stage-wrap${showSettings ? " with-rail" : ""}`}>
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
                <GraphView svg={svg} fitKey={`${slug}:${caseIndex}:${pane?.id ?? ""}:${fitCount}`} />
              ) : (
                <div class="stage" />
              )}
              {!svg && (
                <Placeholder
                  snapshot={snapshot}
                  caseInput={caseInput}
                  error={error}
                  tooLarge={tooLarge}
                  emptyStructure={emptyStructure}
                  emptyNote={pane?.model.notes[0]}
                  nodeCount={paneSize}
                  failure={result.failures[0]?.reason}
                  onConfirmLarge={() => setConfirmedFor(confirmKey)}
                />
              )}
            </div>
          </div>

          <label class="input-bar">
            <span class="input-bar-label">Input</span>
            <textarea
              class="input-bar-field"
              aria-label="Graph input"
              placeholder="Paste a test case, e.g. [1,2,3]"
              spellcheck={false}
              rows={1}
              value={caseInput}
              onFocus={() => {
                inputFocused.current = true;
              }}
              onBlur={() => {
                inputFocused.current = false;
              }}
              onPointerDown={(event) => event.stopPropagation()}
              onInput={(event) => setLocalInput((event.target as HTMLTextAreaElement).value)}
            />
          </label>

          <div class="statusbar">
            {cases.length > 1 && (
              <div class="case-switcher" role="tablist" aria-label="Test cases">
                {cases.map((_, i) => (
                  <button
                    class="case-pill"
                    role="tab"
                    key={i}
                    aria-selected={i === caseIndex}
                    onClick={() => setActiveCase(i)}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
            <span>{countLabel(pane?.model)}</span>
            <span class="spacer" />
            {snapshot && (
              <>
                <span class={`status-dot${snapshot.source === "network" ? "" : " idle"}`} aria-hidden="true" />
                <span>{snapshot.source === "network" ? "run" : "live"}</span>
              </>
            )}
            <span class="grip" onPointerDown={onResizeGrip} title="Resize" tabIndex={0} role="button" aria-label="Resize panel">
              <GripIcon />
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function countLabel(model: GraphModel | undefined): string {
  if (!model) return "waiting for input";
  const unit = model.kind === "matrix" ? "cells" : "nodes";
  return `${visibleNodeCount(model)} ${unit}`;
}

interface PlaceholderProps {
  snapshot: Snapshot | null;
  caseInput: string;
  error: string | null;
  tooLarge: boolean;
  emptyStructure: boolean;
  emptyNote: string | undefined;
  nodeCount: number;
  failure: string | undefined;
  onConfirmLarge: () => void;
}

function Placeholder(props: PlaceholderProps): JSX.Element {
  if (props.error) {
    return (
      <div class="placeholder error">
        <div class="placeholder-card">
          <div class="placeholder-icon">!</div>
          <strong>Layout failed</strong>
          <span>Graphviz could not lay this out.</span>
          <code>{props.error}</code>
        </div>
      </div>
    );
  }
  if (props.snapshot?.captureError) {
    return (
      <div class="placeholder error">
        <div class="placeholder-card">
          <div class="placeholder-icon">!</div>
          <strong>Case split failed</strong>
          <span>{props.snapshot.captureError}</span>
        </div>
      </div>
    );
  }
  if (props.tooLarge) {
    return (
      <div class="placeholder">
        <div class="placeholder-card">
          <div class="placeholder-icon">{props.nodeCount}</div>
          <strong>{props.nodeCount} nodes</strong>
          <span>Large graphs can take a moment to lay out.</span>
          <button type="button" class="btn btn-primary" onClick={props.onConfirmLarge}>Render anyway</button>
        </div>
      </div>
    );
  }
  if (props.emptyStructure) {
    return (
      <div class="placeholder">
        <div class="placeholder-card">
          <div class="placeholder-icon">∅</div>
          <strong>Empty structure</strong>
          <span>{props.emptyNote ?? "This test case has nothing to draw."}</span>
        </div>
      </div>
    );
  }
  if (!props.caseInput.trim()) {
    return (
      <div class="placeholder">
        <div class="placeholder-card">
          <div class="placeholder-icon">∅</div>
          <strong>No test case yet</strong>
          <span>Type a test case below, or hit Run on LeetCode.</span>
        </div>
      </div>
    );
  }
  return (
    <div class="placeholder">
      <div class="placeholder-card">
        <div class="placeholder-icon">?</div>
        <strong>Nothing to draw</strong>
        <span>{props.failure ?? "This input does not look like a graph structure."}</span>
      </div>
    </div>
  );
}
