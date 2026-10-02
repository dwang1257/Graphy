import type { ComponentChildren, JSX } from "preact";
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { CANVAS_PRESETS, EDGE_PRESETS, NODE_FILL_PRESETS, normalizeCssHex, type CanvasPreset } from "../settings/cssColor.js";
import {
  DARK,
  LIGHT,
  THEME_MODES,
  type EdgeStyle,
  type Layout,
  type NodeShape,
  type Palette,
  type Settings,
  type ThemeMode,
} from "../settings/schema.js";
import { CloseIcon, PlusIcon } from "./icons.js";
import { memo } from "./memo.js";
import { STYLE_DRAWER_ID } from "./styleOptions.js";
import { UPLOAD_ERROR, readImageDataUrl, type ImageSlot } from "./imageUpload.js";

export type SettingsUpdate = Settings | ((prev: Settings) => Settings);

type ChangeSettings = (update: SettingsUpdate) => void;

interface Props {
  settings: Settings;
  activePalette: ThemeMode;
  onChange: ChangeSettings;
  onClose: () => void;
}

interface SegmentItem<T extends string> {
  value: T;
  label: string;
}

export const DRAWER_EXIT_MS = 120;

const UNDO_MS = 8000;

const THEME_LABELS: Record<ThemeMode, string> = { light: "Light", dark: "Dark" };

const DEFAULT_PALETTES: Record<ThemeMode, Palette> = { light: LIGHT, dark: DARK };

const THEME_ITEMS: ReadonlyArray<SegmentItem<ThemeMode>> = THEME_MODES.map((value) => ({
  value,
  label: THEME_LABELS[value],
}));

const SHAPE_ITEMS: ReadonlyArray<SegmentItem<NodeShape>> = [
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
  { value: "diamond", label: "Diamond" },
];

const LINE_ITEMS: ReadonlyArray<SegmentItem<EdgeStyle>> = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

const LINE_DASH: Record<EdgeStyle, string | undefined> = {
  solid: undefined,
  dashed: "5 2",
  dotted: "1 4",
};

const PALETTE_KEYS = Object.keys(LIGHT) as Array<keyof Palette>;

function setLayout<K extends keyof Layout>(key: K, value: Layout[K]): (prev: Settings) => Settings {
  return (prev) => (prev.layout[key] === value ? prev : { ...prev, layout: { ...prev.layout, [key]: value } });
}

function setPalette<K extends keyof Palette>(mode: ThemeMode, key: K, value: Palette[K]): (prev: Settings) => Settings {
  return (prev) => (prev[mode][key] === value ? prev : { ...prev, [mode]: { ...prev[mode], [key]: value } });
}

function samePalette(a: Palette, b: Palette): boolean {
  return PALETTE_KEYS.every((key) => a[key] === b[key]);
}

function isHexDraft(value: string): boolean {
  return /^#?[0-9a-f]{0,6}$/i.test(value.trim());
}

function SettingsDrawerView({ settings, activePalette, onChange, onClose }: Props): JSX.Element {
  const rootRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closingRef = useRef(false);
  const restoreFocusRef = useRef(true);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [closing, setClosing] = useState(false);

  const dismiss = useCallback((restoreFocus: boolean) => {
    if (closingRef.current) return;
    closingRef.current = true;
    restoreFocusRef.current = restoreFocus;
    setClosing(true);
    exitTimer.current = setTimeout(() => onCloseRef.current(), DRAWER_EXIT_MS);
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    const active = document.activeElement;
    const previous = active instanceof HTMLElement && active !== document.body ? active : null;
    root?.querySelector<HTMLElement>("[data-initial-focus]")?.focus();
    return () => {
      clearTimeout(exitTimer.current);
      const now = document.activeElement;
      const focusInside = now === null || now === document.body || (root?.contains(now) ?? false);
      if (!restoreFocusRef.current || !focusInside) return;
      const toggle = document.querySelector<HTMLElement>(`[aria-controls="${STYLE_DRAWER_ID}"]`);
      (previous?.isConnected ? previous : toggle)?.focus();
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent): void => {
      const root = rootRef.current;
      const target = event.target;
      if (!root || !(target instanceof Node) || root.contains(target)) return;
      if (target instanceof Element && target.closest(".titlebar")) return;
      dismiss(root.contains(document.activeElement));
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      dismiss(true);
    };
    const onToggleClick = (event: MouseEvent): void => {
      const target = event.target;
      if (!(target instanceof Element) || !target.closest(`[aria-controls="${STYLE_DRAWER_ID}"]`)) return;
      event.preventDefault();
      event.stopPropagation();
      dismiss(true);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onToggleClick, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onToggleClick, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dismiss]);

  const layout = settings.layout;
  const palette = settings[activePalette];

  return (
    <aside
      ref={rootRef}
      id={STYLE_DRAWER_ID}
      class={closing ? "style-drawer is-closing" : "style-drawer"}
      role="dialog"
      aria-labelledby="graphy-style-title"
    >
      <header class="style-drawer-header">
        <h2 id="graphy-style-title">Style</h2>
        <ThemeToggle mode={settings.mode} onChange={onChange} />
        <button class="icon-btn" type="button" aria-label="Close style" title="Close" onClick={() => dismiss(true)}>
          <CloseIcon />
        </button>
      </header>

      <div class="style-drawer-body" style={specimenPaint(palette)}>
        <NodesSection
          mode={activePalette}
          shape={layout.nodeShape}
          fill={palette.nodeFill}
          image={palette.nodeBackgroundImage}
          onChange={onChange}
        />
        <EdgesSection
          mode={activePalette}
          shape={layout.nodeShape}
          edgeStyle={layout.edgeStyle}
          color={palette.edgeColor}
          arrowheads={layout.showArrowheads}
          onChange={onChange}
        />
        <CanvasSection
          mode={activePalette}
          color={palette.background}
          image={palette.backgroundImage}
          onChange={onChange}
        />
        <DisplaySection
          nullChildren={layout.showNullChildren}
          matrixIndices={layout.showMatrixIndices}
          listTerminal={layout.showListTerminal}
          onChange={onChange}
        />
      </div>

      <DrawerFooter mode={activePalette} palette={palette} onChange={onChange} />
    </aside>
  );
}

export const SettingsDrawer = memo(SettingsDrawerView);

function Group(props: { title: string; children: ComponentChildren }): JSX.Element {
  return (
    <section class="style-group" aria-label={props.title}>
      <h3 class="style-group-title">{props.title}</h3>
      {props.children}
    </section>
  );
}

function Row(props: { label: string; htmlFor?: string; children: ComponentChildren }): JSX.Element {
  return (
    <div class="style-row">
      {props.htmlFor ? (
        <label class="style-row-label" for={props.htmlFor}>{props.label}</label>
      ) : (
        <span class="style-row-label">{props.label}</span>
      )}
      <div class="style-row-control">{props.children}</div>
    </div>
  );
}

function specimenPaint(palette: Palette): JSX.CSSProperties {
  return {
    "--specimen-canvas": palette.background,
    "--specimen-fill": palette.nodeFill,
    "--specimen-stroke": palette.nodeStroke,
    "--specimen-edge": palette.edgeColor,
  } as JSX.CSSProperties;
}

const ThemeToggle = memo(function ThemeToggle(props: { mode: ThemeMode; onChange: ChangeSettings }): JSX.Element {
  const { onChange } = props;
  return (
    <Segmented
      label="Theme"
      items={THEME_ITEMS}
      value={props.mode}
      initialFocus
      onSelect={(mode) => onChange((prev) => (prev.mode === mode ? prev : { ...prev, mode }))}
    />
  );
});

const NodesSection = memo(function NodesSection(props: {
  mode: ThemeMode;
  shape: NodeShape;
  fill: string;
  image: string | null;
  onChange: ChangeSettings;
}): JSX.Element {
  const { mode, onChange } = props;
  const pickFill = useCallback((hex: string) => onChange(setPalette(mode, "nodeFill", hex)), [mode, onChange]);
  return (
    <Group title="Nodes">
      <Specimens
        label="Node shape"
        items={SHAPE_ITEMS}
        value={props.shape}
        draw={(shape) => <ShapeGlyph shape={shape} x={20} y={14} r={9} />}
        onSelect={(shape) => onChange(setLayout("nodeShape", shape))}
      />
      <ColorRows
        id="graphy-style-node-fill"
        label="Fill"
        value={props.fill}
        fallback={DEFAULT_PALETTES[mode].nodeFill}
        presets={NODE_FILL_PRESETS}
        onPick={pickFill}
      />
      <ImageRow
        id="graphy-style-node-image"
        subject="node"
        slot="nodeBackgroundImage"
        image={props.image}
        onPick={(image) => onChange(setPalette(mode, "nodeBackgroundImage", image))}
      />
    </Group>
  );
});

const EdgesSection = memo(function EdgesSection(props: {
  mode: ThemeMode;
  shape: NodeShape;
  edgeStyle: EdgeStyle;
  color: string;
  arrowheads: boolean;
  onChange: ChangeSettings;
}): JSX.Element {
  const { mode, onChange } = props;
  const pickColor = useCallback((hex: string) => onChange(setPalette(mode, "edgeColor", hex)), [mode, onChange]);
  return (
    <Group title="Edges">
      <Specimens
        label="Edge line"
        items={LINE_ITEMS}
        value={props.edgeStyle}
        draw={(edgeStyle) => <LineGlyph shape={props.shape} edgeStyle={edgeStyle} arrowhead={props.arrowheads} />}
        onSelect={(edgeStyle) => onChange(setLayout("edgeStyle", edgeStyle))}
      />
      <ColorRows
        id="graphy-style-edge-color"
        label="Color"
        value={props.color}
        fallback={DEFAULT_PALETTES[mode].edgeColor}
        presets={EDGE_PRESETS}
        onPick={pickColor}
      />
      <SwitchRow
        id="graphy-style-arrowheads"
        label="Arrowheads"
        checked={props.arrowheads}
        onToggle={(checked) => onChange(setLayout("showArrowheads", checked))}
      />
    </Group>
  );
});

const CanvasSection = memo(function CanvasSection(props: {
  mode: ThemeMode;
  color: string;
  image: string | null;
  onChange: ChangeSettings;
}): JSX.Element {
  const { mode, onChange } = props;
  const pickColor = useCallback((hex: string) => onChange(setPalette(mode, "background", hex)), [mode, onChange]);
  return (
    <Group title="Canvas">
      <ColorRows
        id="graphy-style-canvas-color"
        label="Color"
        value={props.color}
        fallback={DEFAULT_PALETTES[mode].background}
        presets={CANVAS_PRESETS}
        onPick={pickColor}
      />
      <ImageRow
        id="graphy-style-canvas-image"
        subject="canvas"
        slot="backgroundImage"
        image={props.image}
        onPick={(image) => onChange(setPalette(mode, "backgroundImage", image))}
      />
    </Group>
  );
});

const DisplaySection = memo(function DisplaySection(props: {
  nullChildren: boolean;
  matrixIndices: boolean;
  listTerminal: boolean;
  onChange: ChangeSettings;
}): JSX.Element {
  const { onChange } = props;
  return (
    <Group title="Display">
      <SwitchRow
        id="graphy-style-null-children"
        label="Null children"
        checked={props.nullChildren}
        onToggle={(checked) => onChange(setLayout("showNullChildren", checked))}
      />
      <SwitchRow
        id="graphy-style-matrix-indices"
        label="Grid indices"
        checked={props.matrixIndices}
        onToggle={(checked) => onChange(setLayout("showMatrixIndices", checked))}
      />
      <SwitchRow
        id="graphy-style-list-terminal"
        label="List end marker"
        checked={props.listTerminal}
        onToggle={(checked) => onChange(setLayout("showListTerminal", checked))}
      />
    </Group>
  );
});

const DrawerFooter = memo(function DrawerFooter(props: {
  mode: ThemeMode;
  palette: Palette;
  onChange: ChangeSettings;
}): JSX.Element {
  const { mode, palette, onChange } = props;
  const [undo, setUndo] = useState<{ mode: ThemeMode; palette: Palette } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const defaults = DEFAULT_PALETTES[mode];
  const atDefaults = samePalette(palette, defaults);
  const pending = undo !== null && undo.mode === mode && atDefaults ? undo : null;
  const theme = THEME_LABELS[mode];

  useEffect(() => () => clearTimeout(undoTimer.current), []);

  const onClick = (): void => {
    clearTimeout(undoTimer.current);
    if (pending) {
      setUndo(null);
      onChange((prev) => ({ ...prev, [pending.mode]: pending.palette }));
      return;
    }
    if (atDefaults) return;
    setUndo({ mode, palette });
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS);
    onChange((prev) => ({ ...prev, [mode]: defaults }));
  };

  return (
    <footer class="style-drawer-footer">
      <button
        type="button"
        class="text-btn"
        aria-disabled={!pending && atDefaults}
        title={!pending && atDefaults ? `${theme} theme already uses the default colors` : undefined}
        onClick={onClick}
      >
        {pending ? "Undo reset" : `Reset ${theme} theme`}
      </button>
      <span class="style-drawer-status" role="status">
        {pending ? `${theme} colors restored to defaults.` : ""}
      </span>
    </footer>
  );
});

function Segmented<T extends string>(props: {
  label: string;
  items: ReadonlyArray<SegmentItem<T>>;
  value: T;
  initialFocus?: boolean;
  onSelect: (value: T) => void;
}): JSX.Element {
  return (
    <div class="segmented" role="group" aria-label={props.label}>
      {props.items.map((item) => {
        const pressed = item.value === props.value;
        return (
          <button
            key={item.value}
            type="button"
            class="segment"
            aria-pressed={pressed}
            data-initial-focus={props.initialFocus && pressed ? "" : undefined}
            onClick={() => props.onSelect(item.value)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function Specimens<T extends string>(props: {
  label: string;
  items: ReadonlyArray<SegmentItem<T>>;
  value: T;
  draw: (value: T) => JSX.Element;
  onSelect: (value: T) => void;
}): JSX.Element {
  return (
    <div class="specimens" role="group" aria-label={props.label}>
      {props.items.map((item) => (
        <button
          key={item.value}
          type="button"
          class="specimen"
          aria-pressed={item.value === props.value}
          onClick={() => props.onSelect(item.value)}
        >
          <span class="specimen-canvas">
            <svg class="specimen-glyph" viewBox="0 0 40 28" aria-hidden="true">
              {props.draw(item.value)}
            </svg>
          </span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ShapeGlyph(props: { shape: NodeShape; x: number; y: number; r: number }): JSX.Element {
  const { x, y, r } = props;
  if (props.shape === "circle") return <circle class="glyph-node" cx={x} cy={y} r={r} />;
  if (props.shape === "square") {
    const side = r * 1.8;
    return <rect class="glyph-node" x={x - side / 2} y={y - side / 2} width={side} height={side} />;
  }
  const d = r * 1.25;
  return <path class="glyph-node" d={`M${x} ${y - d}L${x + d} ${y}L${x} ${y + d}L${x - d} ${y}Z`} />;
}

function LineGlyph(props: { shape: NodeShape; edgeStyle: EdgeStyle; arrowhead: boolean }): JSX.Element {
  const end = props.arrowhead ? 26.5 : 31;
  return (
    <>
      <path class="glyph-edge" d={`M9 14H${end}`} stroke-dasharray={LINE_DASH[props.edgeStyle]} />
      {props.arrowhead ? <path class="glyph-arrow" d="M26 11L31 14L26 17Z" /> : null}
      <ShapeGlyph shape={props.shape} x={5} y={14} r={3.5} />
      <ShapeGlyph shape={props.shape} x={35} y={14} r={3.5} />
    </>
  );
}

function SwitchRow(props: { id: string; label: string; checked: boolean; onToggle: (checked: boolean) => void }): JSX.Element {
  return (
    <Row label={props.label} htmlFor={props.id}>
      <button
        id={props.id}
        type="button"
        role="switch"
        class="switch"
        aria-checked={props.checked}
        onClick={() => props.onToggle(!props.checked)}
      >
        <span class="switch-thumb" aria-hidden="true" />
      </button>
    </Row>
  );
}

function ColorRows(props: {
  id: string;
  label: string;
  value: string;
  fallback: string;
  presets: readonly CanvasPreset[];
  onPick: (hex: string) => void;
}): JSX.Element {
  const hex = normalizeCssHex(props.value) ?? props.fallback;
  return (
    <>
      <Row label={props.label} htmlFor={props.id}>
        <HexColorField id={props.id} label={props.label} hex={hex} onPick={props.onPick} />
      </Row>
      <div class="style-row style-row-follow">
        <div class="swatches" role="group" aria-label={`${props.label} presets`}>
          {props.presets.map((preset) => (
            <button
              key={preset.hex}
              type="button"
              class="swatch"
              style={{ "--swatch": preset.hex } as JSX.CSSProperties}
              aria-label={preset.label}
              aria-pressed={hex === preset.hex}
              title={preset.label}
              onClick={() => props.onPick(preset.hex)}
            />
          ))}
        </div>
      </div>
    </>
  );
}

function HexColorField(props: { id: string; label: string; hex: string; onPick: (hex: string) => void }): JSX.Element {
  const { hex, onPick } = props;
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && !isHexDraft(draft);

  const pick = (raw: string): void => {
    const next = normalizeCssHex(raw);
    if (next && next !== hex) onPick(next);
  };

  const commit = (): void => {
    if (draft === null) return;
    pick(draft);
    setDraft(null);
  };

  return (
    <div class="color-field">
      <label class="color-swatch" style={{ "--swatch": hex } as JSX.CSSProperties} title="Open color picker">
        <input
          type="color"
          class="color-swatch-native"
          value={hex}
          aria-label={`${props.label} picker`}
          onInput={(event) => pick(event.currentTarget.value)}
        />
      </label>
      <input
        id={props.id}
        type="text"
        class="color-hex"
        value={draft ?? hex}
        spellcheck={false}
        autocomplete="off"
        autocapitalize="off"
        maxlength={7}
        aria-invalid={invalid}
        title={invalid ? "Use a hex color like #7031a6" : undefined}
        onInput={(event) => {
          const raw = event.currentTarget.value;
          setDraft(raw);
          if (/^#?[0-9a-f]{6}$/i.test(raw.trim())) pick(raw);
        }}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          } else if (event.key === "Escape" && draft !== null) {
            event.preventDefault();
            setDraft(null);
          }
        }}
      />
      {invalid ? <span class="color-field-flag" aria-hidden="true">!</span> : null}
    </div>
  );
}

type UploadState = { status: "idle" } | { status: "loading" } | { status: "error"; message: string };

function ImageRow(props: {
  id: string;
  subject: string;
  slot: ImageSlot;
  image: string | null;
  onPick: (image: string | null) => void;
}): JSX.Element {
  const [upload, setUpload] = useState<UploadState>({ status: "idle" });
  const loading = upload.status === "loading";
  const errorId = `${props.id}-error`;
  let fileLabel = props.image ? "Replace" : "Add image";
  if (loading) fileLabel = "Reading…";

  const onFile = async (input: HTMLInputElement): Promise<void> => {
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    setUpload({ status: "loading" });
    try {
      props.onPick(await readImageDataUrl(file, props.slot));
      setUpload({ status: "idle" });
    } catch (cause) {
      setUpload({
        status: "error",
        message: cause instanceof Error ? cause.message : UPLOAD_ERROR,
      });
    }
  };

  return (
    <>
      <Row label="Image" htmlFor={props.id}>
        <div class="image-field">
          {props.image ? <img class="image-thumb" src={props.image} alt="" width={20} height={20} /> : null}
          <label
            class={props.image ? "text-btn file-btn" : "file-btn file-drop"}
            data-state={upload.status}
            aria-busy={loading}
          >
            {props.image ? null : <PlusIcon />}
            {fileLabel}
            <input
              id={props.id}
              type="file"
              accept="image/*"
              class="file-input"
              disabled={loading}
              aria-invalid={upload.status === "error"}
              aria-describedby={upload.status === "error" ? errorId : undefined}
              onChange={(event) => void onFile(event.currentTarget)}
            />
          </label>
          {props.image && !loading ? (
            <button
              type="button"
              class="icon-btn"
              aria-label={`Remove ${props.subject} image`}
              title="Remove image"
              onClick={() => {
                setUpload({ status: "idle" });
                props.onPick(null);
              }}
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>
      </Row>
      {upload.status === "error" ? (
        <p id={errorId} class="field-error" role="alert">{upload.message}</p>
      ) : null}
    </>
  );
}
