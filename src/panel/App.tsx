import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";

import { clampCaseIndex } from "../core/cases.js";
import { traceTextForCase } from "../core/traceCases.js";
import { buildPanes } from "../core/build.js";
import { parseSignature, type Signature } from "../core/signature.js";
import { EMPTY_TRACE, buildTrace } from "../core/trace.js";
import { EMPTY_CUSTOM_COPY, EMPTY_STAGE_COPY, isEmptyStage, isTooLarge, tooLargeCopy } from "./emptyStage.js";
import { visibleNodeCount, type StructureKind } from "../core/types.js";
import { useStructureKind } from "./useStructureKind.js";
import { DEFAULT_SETTINGS, type Settings } from "../settings/schema.js";
import {
  loadOverrides,
  loadPanelState,
  loadPrivacyNoticeDismissed,
  loadSettings,
  onSettingsChanged,
  saveOverrides,
  savePrivacyNoticeDismissed,
  saveSettings,
  withOverrideKind,
  type Override,
} from "../settings/storage.js";
import { PANEL_CHANNEL, isToPanel, type FromPanel, type Snapshot } from "../shared/protocol.js";

import { SETTINGS_DOT_DEBOUNCE_MS, dotStyleKey } from "./dotStyle.js";
import { GraphView } from "./GraphView.js";
import { SettingsDrawer } from "./SettingsDrawer.js";
import { PrivacyNotice } from "./privacyNotice.js";
import { CUSTOM_CASE, CaseTabs, caseTabId, type CaseSelection, type CaseTabActivation } from "./CaseTabs.js";
import { CustomInput } from "./CustomInput.js";
import {
  EMPTY_CUSTOM_CASE,
  addField,
  canAddField,
  customFields,
  customInput,
  customKinds,
  pasteValues,
  removeField,
  setFieldKind,
  setFieldValue,
  type CustomCase,
} from "./customCase.js";
import { inkFromDataUrl } from "./imageInk.js";
import { compactSettingsImages } from "./imageUpload.js";
import { stageBackgroundStyle, stageInkVars } from "./stageBackground.js";
import { TitleBar } from "./TitleBar.js";
import { TracePlayback } from "./TracePlayback.js";
import { useSceneRender } from "./useSceneRender.js";
import { preload } from "./graphviz.js";
import { detectParentOrigin, isAllowedParentOrigin } from "./parentOrigin.js";

const PARENT_ORIGIN = detectParentOrigin();

function signatureOf(snapshot: Snapshot): Signature | null {
  if (snapshot.params && snapshot.params.length > 0) return { method: "", params: snapshot.params };
  return parseSignature(snapshot.code, snapshot.lang);
}

function toHost(message: FromPanel): void {
  if (!PARENT_ORIGIN) return;
  parent.postMessage(message, PARENT_ORIGIN);
}

export function App(): JSX.Element {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [activeCase, setActiveCase] = useState<CaseSelection>(0);
  const [customCases, setCustomCases] = useState<Record<string, CustomCase>>({});
  const [customFocusRequest, setCustomFocusRequest] = useState(0);
  const [fitCount, setFitCount] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [traceIndex, setTraceIndex] = useState(0);
  const [tracePlaying, setTracePlaying] = useState(false);
  const [shrunk, setShrunk] = useState(false);
  const [stageImageInk, setStageImageInk] = useState<string | null>(null);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(true);

  const lastSaved = useRef("");
  const saveTimer = useRef<number | undefined>(undefined);
  const lastSlug = useRef("");
  const sawHostShrunk = useRef(false);
  const customFieldRef = useRef<HTMLTextAreaElement>(null);
  const statusbarRef = useRef<HTMLDivElement>(null);
  const [statusbarHeight, setStatusbarHeight] = useState(0);

  useEffect(() => {
    preload();
    void loadSettings().then(async (loaded) => {
      setSettings(loaded);
      const compacted = await compactSettingsImages(loaded);
      if (compacted === loaded) return;
      setSettings(compacted);
      lastSaved.current = JSON.stringify(compacted);
      void saveSettings(compacted);
    });
    void loadOverrides().then(setOverrides);
    void loadPanelState().then((state) => {
      if (!sawHostShrunk.current) setShrunk(state.shrunk);
    });
    void loadPrivacyNoticeDismissed().then((dismissed) => setShowPrivacyNotice(!dismissed));
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
      if (data.type === "clear") {
        setSnapshot(null);
        setActiveCase(0);
        setTraceIndex(0);
        setTracePlaying(false);
        return;
      }
      setSnapshot(data.payload);
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
  const customCase = customCases[slug] ?? EMPTY_CUSTOM_CASE;
  const caseIndex = activeCase === CUSTOM_CASE ? null : clampCaseIndex(activeCase, cases.length);
  const tabSelection: CaseSelection | null =
    caseIndex === null ? CUSTOM_CASE : cases.length > 0 ? caseIndex : null;

  useEffect(() => {
    if (slug === lastSlug.current) return;
    lastSlug.current = slug;
    setActiveCase((prev) => (prev === CUSTOM_CASE && cases.length === 0 ? prev : 0));
  }, [slug]);

  useEffect(() => {
    if (customFocusRequest > 0) customFieldRef.current?.focus();
  }, [customFocusRequest]);

  const selectCase = useCallback((selection: CaseSelection, activation: CaseTabActivation) => {
    setActiveCase(selection);
    if (selection === CUSTOM_CASE && activation === "click") setCustomFocusRequest((n) => n + 1);
  }, []);

  const updateCustomCase = useCallback(
    (update: (current: CustomCase) => CustomCase) => {
      setCustomCases((prev) => ({ ...prev, [slug]: update(prev[slug] ?? EMPTY_CUSTOM_CASE) }));
    },
    [slug],
  );

  const applyCustomDraft = useCallback(
    () => updateCustomCase((current) => ({ ...current, applied: current.draft, revision: current.revision + 1 })),
    [updateCustomCase],
  );

  const override = overrides[slug] ?? {};

  const persistKind = useCallback((kind: StructureKind | undefined) => {
    if (!slug) return;
    setOverrides((prev) => {
      const all = withOverrideKind(prev, slug, kind);
      void saveOverrides(all);
      return all;
    });
  }, [slug]);
  const { selectedKind, setKind } = useStructureKind(slug, override.kind, persistKind);

  const paramsKey = snapshot?.params ? JSON.stringify(snapshot.params) : "";
  const signature = useMemo(
    () => (snapshot ? signatureOf(snapshot) : null),
    [snapshot?.code, snapshot?.lang, paramsKey],
  );

  const caseInput = caseIndex === null ? customInput(customCase.applied) : cases[caseIndex] ?? "";
  const caseKinds = useMemo(
    () => (caseIndex === null ? customKinds(customCase.applied) : undefined),
    [caseIndex, customCase.applied],
  );

  const result = useMemo(
    () => buildPanes(caseInput, signature, {
      override: selectedKind,
      kinds: caseKinds,
      showIndices: settings.layout.showMatrixIndices,
    }),
    [caseInput, signature, selectedKind, caseKinds, settings.layout.showMatrixIndices],
  );
  const panes = result.panes;

  const fields = useMemo(
    () => (caseIndex === null ? customFields(customCase.draft, signature) : []),
    [caseIndex, customCase.draft, signature],
  );

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

  const traceText = caseIndex === null ? "" : traceTextForCase(snapshot, caseIndex);
  const trace = useMemo(
    () => (traceText && panes.length > 0 ? buildTrace(traceText, panes) : EMPTY_TRACE),
    [traceText, panes],
  );

  useEffect(() => {
    setTraceIndex(0);
    setTracePlaying(false);
  }, [traceText, panes, caseIndex]);

  const nodeCount = panes.reduce((total, pane) => total + visibleNodeCount(pane.model), 0);
  const tooLarge = isTooLarge(nodeCount);
  const emptyStage = isEmptyStage({
    caseInput,
    nodeCount,
    hasFailure: result.failures.length > 0,
    hasPane: panes.length > 0,
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

  const scene = useSceneRender({
    panes,
    trace,
    frameIndex: traceIndex,
    emit: { palette, layout: settings.layout },
    styleKey: debouncedStyleKey,
    showTerminal: settings.layout.showListTerminal,
    enabled: panes.length > 0 && !tooLarge && !emptyStage,
  });

  const rendering = scene.baseDot !== "" && !scene.error;

  const viewKey = `${slug}:${caseIndex ?? `custom-${customCase.revision}`}:${selectedKind ?? ""}:${panes.map((pane) => pane.id).join("")}`;
  const renderedViewKey = useRef(viewKey);
  if (scene.renderedBaseDot === scene.baseDot) renderedViewKey.current = viewKey;
  const fitKey = `${renderedViewKey.current}:${fitCount}`;

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
    () => ({
      "--stage-bg": palette.background,
      "--statusbar-height": `${statusbarHeight}px`,
      ...stageInkVars(palette.background, stageImageInk),
    }) as JSX.CSSProperties,
    [palette.background, stageImageInk, statusbarHeight],
  );

  useEffect(() => {
    const el = statusbarRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setStatusbarHeight(el.getBoundingClientRect().height));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      class={`panel${settings.mode === "dark" ? " dark" : ""}${shrunk ? " is-shrunk" : ""}`}
      style={panelStyle}
    >
      <TitleBar
        showSettings={showSettings}
        selectedKind={selectedKind}
        detectedKinds={result.detected}
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
        {showPrivacyNotice && (
          <PrivacyNotice
            onDismiss={() => {
              setShowPrivacyNotice(false);
              void savePrivacyNoticeDismissed();
            }}
          />
        )}
        {showSettings && (
          <SettingsDrawer
            settings={settings}
            activePalette={settings.mode}
            onChange={updateSettings}
            onClose={() => setShowSettings(false)}
          />
        )}
        <div
          class="stage-area"
          id="graphy-case-panel"
          role={tabSelection === null ? undefined : "tabpanel"}
          aria-labelledby={tabSelection === null ? undefined : caseTabId(tabSelection)}
          style={stageStyle}
        >
          {scene.svg ? (
            <GraphView
              svg={scene.svg}
              fitKey={fitKey}
              nodeBackgroundImage={palette.nodeBackgroundImage}
              traceFrame={trace.frames[traceIndex] ?? null}
              morphFromSvg={scene.morphFromSvg}
              morph={!!scene.morphFromSvg}
            />
          ) : (
            <>
              <div class="stage" />
              {!rendering && <Placeholder
                captureError={caseIndex === null ? undefined : snapshot?.captureError}
                emptyCopy={caseIndex === null ? EMPTY_CUSTOM_COPY : EMPTY_STAGE_COPY}
                error={scene.error}
                tooLarge={tooLarge}
                nodeCount={nodeCount}
                emptyStage={emptyStage}
                failures={result.failures.map((failure) => failure.reason)}
              />}
            </>
          )}
        </div>
      </div>

      <div class="statusbar" ref={statusbarRef}>
        <CaseTabs count={cases.length} selection={tabSelection} onChange={selectCase} />
        {caseIndex === null && (
          <CustomInput
            fields={fields}
            canAddField={canAddField(customCase.draft, signature)}
            onValueChange={(i, value) => updateCustomCase((c) => ({ ...c, draft: setFieldValue(c.draft, i, value) }))}
            onKindChange={(i, kind) => updateCustomCase((c) => ({ ...c, draft: setFieldKind(c.draft, i, kind) }))}
            onPasteValues={(i, values) => updateCustomCase((c) => ({ ...c, draft: pasteValues(c.draft, i, values, signature) }))}
            onAddField={() => updateCustomCase((c) => ({ ...c, draft: addField(c.draft) }))}
            onRemoveField={(i) => updateCustomCase((c) => ({ ...c, draft: removeField(c.draft, i) }))}
            onApply={applyCustomDraft}
            inputRef={customFieldRef}
          />
        )}
        <TracePlayback
          frames={trace.frames}
          truncated={trace.truncated}
          index={traceIndex}
          playing={tracePlaying}
          onIndexChange={setTraceIndex}
          onPlayingChange={setTracePlaying}
        />
      </div>
    </div>
  );
}

interface PlaceholderProps {
  captureError: string | undefined;
  emptyCopy: string;
  error: string | null;
  tooLarge: boolean;
  nodeCount: number;
  emptyStage: boolean;
  failures: string[];
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

  let messages = props.failures.length > 0 ? props.failures : ["This input does not look like a graph structure."];
  let error = false;
  if (props.captureError) {
    messages = [props.captureError];
    error = true;
  } else if (props.tooLarge) {
    messages = [tooLargeCopy(props.nodeCount)];
    error = true;
  } else if (props.emptyStage) {
    messages = [props.emptyCopy];
  }

  return (
    <div class={error ? "placeholder error" : "placeholder"}>
      {messages.map((message) => <p key={message}>{message}</p>)}
    </div>
  );
}
