import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";

import { buildPanes } from "../core/build.js";
import { emitDot } from "../core/dot/emit.js";
import { parseSignature } from "../core/signature.js";
import { KIND_LABELS, visibleNodeCount, type GraphModel, type StructureKind } from "../core/types.js";
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

const DIRECTIONAL: StructureKind[] = ["graph", "adjacency"];

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
  const [active, setActive] = useState(0);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  const [fitCount, setFitCount] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});

  const liveUpdate = useRef(true);
  liveUpdate.current = settings.liveUpdate;
  const hasRendered = useRef(false);
  const lastSaved = useRef("");
  const saveTimer = useRef<number | undefined>(undefined);

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
  const override = overrides[slug] ?? {};
  const overrideKind = (override.kind as StructureKind | undefined) ?? "auto";

  const signature = useMemo(
    () => (snapshot ? parseSignature(snapshot.code, snapshot.lang) : null),
    [snapshot?.code, snapshot?.lang],
  );

  const result = useMemo(
    () =>
      buildPanes(snapshot?.input ?? "", signature, {
        override: overrideKind === "auto" ? undefined : overrideKind,
        directedOverride: override.directed,
        showTerminal: settings.layout.showListTerminal,
        showIndices: settings.layout.showMatrixIndices,
      }),
    [
      snapshot?.input,
      signature,
      overrideKind,
      override.directed,
      settings.layout.showListTerminal,
      settings.layout.showMatrixIndices,
    ],
  );

  const pane = result.panes[Math.min(active, Math.max(0, result.panes.length - 1))];
  const paletteName = resolvedPalette(settings.mode, pageIsDark);
  const palette = settings[paletteName];

  const paneSize = pane ? visibleNodeCount(pane.model) : 0;
  const confirmKey = `${snapshot?.input ?? ""}:${overrideKind}`;
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

  const applyOverride = useCallback(
    (patch: Override) => {
      if (!slug) return;
      setOverrides((prev) => {
        const all = { ...prev, [slug]: { ...prev[slug], ...patch } };
        void saveOverrides(all);
        return all;
      });
    },
    [slug],
  );

  const setKind = useCallback(
    (kind: StructureKind | "auto") => {
      applyOverride({ kind: kind === "auto" ? undefined : kind });
      setActive(0);
    },
    [applyOverride],
  );

  const setDirected = useCallback(
    (directed: boolean) => applyOverride({ directed }),
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

  const onResizeGrip = pointerDragHandler<HTMLSpanElement>({
    onMove: (dx, dy) => toHost({ channel: PANEL_CHANNEL, type: "resize", dx, dy }),
    onEnd: () => toHost({ channel: PANEL_CHANNEL, type: "persist" }),
  });

  return (
    <div class={`panel${paletteName === "dark" ? " dark" : ""}`}>
      <TitleBar
        collapsed={collapsed}
        showSettings={showSettings}
        detectedKind={pane?.model.kind ?? null}
        overrideKind={overrideKind}
        directed={pane?.model.directed ?? false}
        canToggleDirection={!!pane && DIRECTIONAL.includes(pane.model.kind)}
        onKindChange={setKind}
        onDirectionChange={setDirected}
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
          {result.panes.length > 1 && (
            <div class="tabs" role="tablist">
              {result.panes.map((p, i) => (
                <button
                  class="tab"
                  role="tab"
                  key={p.id}
                  aria-selected={i === active}
                  onClick={() => setActive(i)}
                >
                  {p.title}
                </button>
              ))}
            </div>
          )}

          <div class="stage-wrap">
            {svg ? <GraphView svg={svg} fitKey={`${pane?.id ?? ""}:${fitCount}`} /> : <div class="stage" />}
            {!svg && (
              <Placeholder
                snapshot={snapshot}
                error={error}
                tooLarge={tooLarge}
                nodeCount={paneSize}
                failure={result.failures[0]?.reason}
                onConfirmLarge={() => setConfirmedFor(confirmKey)}
              />
            )}
            {showSettings && (
              <SettingsDrawer
                settings={settings}
                activePalette={paletteName}
                onChange={updateSettings}
              />
            )}
          </div>

          <div class="statusbar">
            {pane && <span class="pill">{KIND_LABELS[pane.model.kind]}</span>}
            <span>{countLabel(pane?.model)}</span>
            {pane?.model.notes[0] && <span>{pane.model.notes[0]}</span>}
            <span class="spacer" />
            {snapshot && <span>{snapshot.source === "network" ? "from Run" : "live"}</span>}
            <span class="grip" onPointerDown={onResizeGrip} title="Resize"><GripIcon /></span>
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
        <strong>Graphviz could not lay this out</strong>
        <code>{props.error}</code>
      </div>
    );
  }
  if (props.tooLarge) {
    return (
      <div class="placeholder">
        <strong>{props.nodeCount} nodes</strong>
        <span>Large graphs can take a moment to lay out.</span>
        <button class="ghost-btn" onClick={props.onConfirmLarge}>Render anyway</button>
      </div>
    );
  }
  if (!props.snapshot || !props.snapshot.input.trim()) {
    return (
      <div class="placeholder">
        <strong>No test case yet</strong>
        <span>Type a custom test case or hit Run, and it will appear here.</span>
      </div>
    );
  }
  return (
    <div class="placeholder">
      <strong>Nothing to draw</strong>
      <span>{props.failure ?? "This input does not look like a graph structure."}</span>
    </div>
  );
}
