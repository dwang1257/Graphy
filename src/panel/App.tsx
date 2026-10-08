import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";

import { clampCaseIndex } from "../core/cases.js";
import { traceTextForCase } from "../core/traceCases.js";
import { buildPanes } from "../core/build.js";
import { parseSignature, type Signature } from "../core/signature.js";
import { EMPTY_TRACE, buildTrace } from "../core/trace.js";
import { visibleNodeCount, type StructureKind } from "../core/types.js";
import { DEFAULT_SETTINGS, type Settings } from "../settings/schema.js";
import { extractImages, mergeImages, sameImages, sameSettings } from "../settings/split.js";
import {
  loadOverrides,
  loadPanelState,
  loadSettings,
  onSettingsChanged,
  saveOverrides,
  saveSettings,
  withOverrideKind,
  type Override,
} from "../settings/storage.js";
import { PANEL_CHANNEL, isToPanel, type FromPanel, type Snapshot } from "../shared/protocol.js";

import { objectUrlFor } from "./blobUrl.js";
import { EMPTY_CUSTOM_COPY, EMPTY_STAGE_COPY, isEmptyStage, isTooLarge, tooLargeCopy } from "./emptyStage.js";
import { GraphView } from "./GraphView.js";
import { SettingsDrawer, type SettingsUpdate } from "./SettingsDrawer.js";
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
  type CustomDraft,
  type FieldKind,
} from "./customCase.js";
import { useImageInk } from "./imageInk.js";
import { compactSettingsImages } from "./imageUpload.js";
import { stageBackdropStyle, stageInkVars, useImageAspect } from "./stageBackground.js";
import { svgPaint } from "./svgPaint.js";
import { TitleBar } from "./TitleBar.js";
import { TracePlayback } from "./TracePlayback.js";
import { useSceneRender } from "./useSceneRender.js";
import { useStructureKind } from "./useStructureKind.js";
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

export const SETTINGS_SAVE_DELAY_MS = 300;

export function App(): JSX.Element | null {
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
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

  const settingsRef = useRef(settings);
  const saveTimer = useRef<number | undefined>(undefined);
  const shrunkRef = useRef(shrunk);
  shrunkRef.current = shrunk;
  const lastSlug = useRef("");
  const sawHostShrunk = useRef(false);
  const customFieldRef = useRef<HTMLTextAreaElement>(null);
  const statusbarRef = useRef<HTMLDivElement>(null);

  const commitSettings = useCallback((next: Settings) => {
    settingsRef.current = next;
    setSettingsState(next);
  }, []);

  const flushSettingsSave = useCallback(() => {
    if (saveTimer.current === undefined) return;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = undefined;
    void saveSettings(settingsRef.current);
  }, []);

  const updateSettings = useCallback((update: SettingsUpdate) => {
    const prev = settingsRef.current;
    const next = typeof update === "function" ? update(prev) : update;
    if (next === prev) return;
    commitSettings(next);
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flushSettingsSave, SETTINGS_SAVE_DELAY_MS);
  }, [commitSettings, flushSettingsSave]);

  useEffect(() => {
    preload();
    void loadSettings().then(async (loaded) => {
      commitSettings(loaded);
      setSettingsLoaded(true);
      const compacted = await compactSettingsImages(loaded);
      if (compacted === loaded) return;
      updateSettings((prev) =>
        sameImages(extractImages(prev), extractImages(loaded)) ? mergeImages(prev, extractImages(compacted)) : prev,
      );
    });
    void loadOverrides().then(setOverrides);
    void loadPanelState().then((state) => {
      if (!sawHostShrunk.current) setShrunk(state.shrunk);
    });
    const stop = onSettingsChanged((update) => {
      const prev = settingsRef.current;
      const next = update(prev);
      if (!sameSettings(prev, next)) commitSettings(next);
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
    const onVisibility = (): void => {
      if (document.visibilityState === "hidden") flushSettingsSave();
    };

    window.addEventListener("message", onMessage);
    window.addEventListener("pagehide", flushSettingsSave);
    document.addEventListener("visibilitychange", onVisibility);
    toHost({ channel: PANEL_CHANNEL, type: "ready" });
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("pagehide", flushSettingsSave);
      document.removeEventListener("visibilitychange", onVisibility);
      flushSettingsSave();
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
  let tabSelection: CaseSelection | null = CUSTOM_CASE;
  if (caseIndex !== null) tabSelection = cases.length > 0 ? caseIndex : null;

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
  const stageImageInk = useImageInk(palette.backgroundImage);
  const nodeImageInk = useImageInk(palette.nodeBackgroundImage);
  const nodeImageUrl = useMemo(
    () => (palette.nodeBackgroundImage ? objectUrlFor(palette.nodeBackgroundImage) : null),
    [palette.nodeBackgroundImage],
  );
  const paint = useMemo(
    () => svgPaint(palette, nodeImageUrl, nodeImageInk ?? undefined),
    [palette, nodeImageUrl, nodeImageInk],
  );

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

  const scene = useSceneRender({
    panes,
    trace,
    frameIndex: traceIndex,
    layout: settings.layout,
    enabled: settingsLoaded && panes.length > 0 && !tooLarge && !emptyStage,
  });

  const rendering = scene.baseDot !== "" && !scene.error;

  const viewKey = `${slug}:${caseIndex ?? `custom-${customCase.revision}`}:${selectedKind ?? ""}:${panes.map((pane) => pane.id).join("")}`;
  const renderedViewKey = useRef(viewKey);
  if (scene.renderedBaseDot === scene.baseDot) renderedViewKey.current = viewKey;
  const fitKey = `${renderedViewKey.current}:${fitCount}`;

  const fitGraph = useCallback(() => setFitCount((n) => n + 1), []);
  const toggleSettings = useCallback(() => {
    if (shrunkRef.current) {
      toHost({ channel: PANEL_CHANNEL, type: "setShrunk", shrunk: false });
      setShowSettings(true);
      return;
    }
    setShowSettings((v) => !v);
  }, []);
  const closeDrawer = useCallback(() => setShowSettings(false), []);
  const closePanel = useCallback(() => toHost({ channel: PANEL_CHANNEL, type: "close" }), []);
  const toggleShrunk = useCallback(
    () => toHost({ channel: PANEL_CHANNEL, type: "setShrunk", shrunk: !shrunkRef.current }),
    [],
  );
  const movePanel = useCallback((dx: number, dy: number) => toHost({ channel: PANEL_CHANNEL, type: "move", dx, dy }), []);
  const persistPanel = useCallback(() => toHost({ channel: PANEL_CHANNEL, type: "persist" }), []);

  const updateCustomDraft = useCallback(
    (update: (draft: CustomDraft) => CustomDraft) => updateCustomCase((c) => ({ ...c, draft: update(c.draft) })),
    [updateCustomCase],
  );
  const changeCustomValue = useCallback(
    (i: number, value: string) => updateCustomDraft((draft) => setFieldValue(draft, i, value)),
    [updateCustomDraft],
  );
  const changeCustomKind = useCallback(
    (i: number, kind: FieldKind) => updateCustomDraft((draft) => setFieldKind(draft, i, kind)),
    [updateCustomDraft],
  );
  const pasteCustomValues = useCallback(
    (i: number, values: string[]) => updateCustomDraft((draft) => pasteValues(draft, i, values, signature)),
    [updateCustomDraft, signature],
  );
  const addCustomField = useCallback(() => updateCustomDraft(addField), [updateCustomDraft]);
  const removeCustomField = useCallback(
    (i: number) => updateCustomDraft((draft) => removeField(draft, i)),
    [updateCustomDraft],
  );

  const stageImageAspect = useImageAspect(palette.backgroundImage);
  const backdropStyle = useMemo(
    () => stageBackdropStyle(palette.backgroundImage, stageImageAspect),
    [palette.backgroundImage, stageImageAspect],
  );
  const panelStyle = useMemo(
    () => ({
      "--stage-bg": palette.background,
      ...stageInkVars(palette.background, stageImageInk),
    }) as JSX.CSSProperties,
    [palette.background, stageImageInk],
  );

  useLayoutEffect(() => {
    const el = statusbarRef.current;
    const panel = el?.closest<HTMLElement>(".panel");
    if (!el || !panel || typeof ResizeObserver === "undefined") return;
    let height = -1;
    const sync = (): void => {
      const next = el.offsetHeight;
      if (next === height) return;
      height = next;
      panel.style.setProperty("--statusbar-height", `${next}px`);
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    return () => observer.disconnect();
  }, [settingsLoaded]);

  if (!settingsLoaded) return null;

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
        onFit={fitGraph}
        onToggleSettings={toggleSettings}
        onClose={closePanel}
        shrunk={shrunk}
        onToggleShrunk={toggleShrunk}
        onDrag={movePanel}
        onDragEnd={persistPanel}
      />

      <div class="stage-wrap">
        {showSettings && (
          <SettingsDrawer
            settings={settings}
            activePalette={settings.mode}
            onChange={updateSettings}
            onClose={closeDrawer}
          />
        )}
        <div
          class="stage-area"
          id="graphy-case-panel"
          role={tabSelection === null ? undefined : "tabpanel"}
          aria-labelledby={tabSelection === null ? undefined : caseTabId(tabSelection)}
        >
          {backdropStyle && (
            <div class="stage-backdrop" style={backdropStyle} aria-hidden="true">
              <div class="stage-backdrop-fill" />
              <div class="stage-backdrop-image" />
            </div>
          )}
          {scene.svg ? (
            <GraphView
              svg={scene.svg}
              fitKey={fitKey}
              paint={paint}
              traceFrame={trace.frames[traceIndex] ?? null}
              morphFromSvg={scene.morphFromSvg}
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
            onValueChange={changeCustomValue}
            onKindChange={changeCustomKind}
            onPasteValues={pasteCustomValues}
            onAddField={addCustomField}
            onRemoveField={removeCustomField}
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

function placeholderMessages(props: PlaceholderProps): { messages: string[]; error: boolean } {
  if (props.captureError) return { messages: [props.captureError], error: true };
  if (props.tooLarge) return { messages: [tooLargeCopy(props.nodeCount)], error: true };
  if (props.emptyStage) return { messages: [props.emptyCopy], error: false };
  if (props.failures.length > 0) return { messages: props.failures, error: false };
  return { messages: ["This input does not look like a graph structure."], error: false };
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

  const { messages, error } = placeholderMessages(props);
  return (
    <div class={error ? "placeholder error" : "placeholder"}>
      {messages.map((message) => <p key={message}>{message}</p>)}
    </div>
  );
}
