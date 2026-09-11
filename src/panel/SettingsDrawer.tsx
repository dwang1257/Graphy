import type { ComponentChildren, JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { CANVAS_PRESETS, NODE_FILL_PRESETS, normalizeCssHex, type CanvasPreset } from "../settings/cssColor.js";
import {
  DEFAULT_LAYOUT,
  DARK,
  LIGHT,
  type EdgeStyle,
  type NodeShape,
  type Palette,
  type Settings,
  type ThemeMode,
} from "../settings/schema.js";
import {
  CircleIcon,
  CloseIcon,
  DiamondIcon,
  DoubleCircleIcon,
  EdgeBoldIcon,
  EdgeDashedIcon,
  EdgeDottedIcon,
  EdgeSolidIcon,
  EllipseIcon,
  HexagonIcon,
  SquareIcon,
} from "./icons.js";
import { styleEdgeStyles, styleNodeShapes } from "./styleOptions.js";

interface Props {
  settings: Settings;
  activePalette: "light" | "dark";
  onChange: (next: Settings) => void;
  onClose: () => void;
}

const SHAPE_ICONS: Record<Exclude<NodeShape, "plaintext" | "box">, () => JSX.Element> = {
  circle: CircleIcon,
  ellipse: EllipseIcon,
  square: SquareIcon,
  diamond: DiamondIcon,
  hexagon: HexagonIcon,
  doublecircle: DoubleCircleIcon,
};

const EDGE_ICONS: Record<EdgeStyle, () => JSX.Element> = {
  solid: EdgeSolidIcon,
  dashed: EdgeDashedIcon,
  dotted: EdgeDottedIcon,
  bold: EdgeBoldIcon,
};

const MODES: Array<{ value: ThemeMode; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

export function SettingsDrawer({ settings, activePalette, onChange, onClose }: Props): JSX.Element {
  const layout = settings.layout;
  const palette = settings[activePalette];
  const defaults = activePalette === "light" ? LIGHT : DARK;

  function setLayout<K extends keyof typeof layout>(key: K, value: (typeof layout)[K]): void {
    onChange({ ...settings, layout: { ...layout, [key]: value } });
  }

  function setPalette(patch: Partial<Palette>): void {
    onChange({ ...settings, [activePalette]: { ...palette, ...patch } });
  }

  function onImageUpload(file: File | undefined, key: "backgroundImage" | "nodeBackgroundImage"): void {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPalette({ [key]: reader.result });
    };
    reader.readAsDataURL(file);
  }

  function resetStyle(): void {
    onChange({
      ...settings,
      layout: {
        ...layout,
        nodeShape: DEFAULT_LAYOUT.nodeShape,
        edgeStyle: DEFAULT_LAYOUT.edgeStyle,
        showArrowheads: DEFAULT_LAYOUT.showArrowheads,
      },
      [activePalette]: {
        ...palette,
        background: defaults.background,
        backgroundImage: defaults.backgroundImage,
        nodeBackgroundImage: defaults.nodeBackgroundImage,
        nodeFill: defaults.nodeFill,
        edgeColor: defaults.edgeColor,
      },
    });
  }

  return (
    <aside class="style-rail" role="dialog" aria-label="Style your graph">
      <header class="style-rail-header">
        <button class="icon-btn" type="button" aria-label="Close style panel" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      <div class="style-rail-body">
        <Section title="APPEARANCE">
          <ChoiceGroup
            ariaLabel="Color mode"
            cols={2}
            items={MODES.map(({ value, label }) => ({
              key: value,
              label,
              pressed: settings.mode === value,
              onClick: () => onChange({ ...settings, mode: value }),
            }))}
          />
        </Section>

        <Section title="NODE SHAPE">
          <ChoiceGroup
            ariaLabel="Node shape"
            items={styleNodeShapes().map(([value, label]) => ({
              key: value,
              label,
              ariaLabel: label,
              pressed: layout.nodeShape === value,
              icon: SHAPE_ICONS[value],
              onClick: () => setLayout("nodeShape", value),
            }))}
          />
        </Section>

        <Section title="EDGES">
          <ChoiceGroup
            ariaLabel="Edge style"
            cols={4}
            items={styleEdgeStyles().map(([value, label]) => ({
              key: value,
              label,
              ariaLabel: label,
              pressed: layout.edgeStyle === value,
              icon: EDGE_ICONS[value],
              onClick: () => setLayout("edgeStyle", value),
            }))}
          />
          <HexColorField
            id="edge-hex"
            label="Color"
            ariaLabel="Edge color"
            value={palette.edgeColor}
            fallback={defaults.edgeColor}
            onChange={(edgeColor) => setPalette({ edgeColor })}
          />
          <label class="color-field-label">Arrows</label>
          <ChoiceGroup
            ariaLabel="Arrowheads"
            cols={2}
            items={[
              { key: "on", label: "On", pressed: layout.showArrowheads, onClick: () => setLayout("showArrowheads", true) },
              { key: "off", label: "Off", pressed: !layout.showArrowheads, onClick: () => setLayout("showArrowheads", false) },
            ]}
          />
        </Section>

        <Section title="BACKGROUND">
          <HexColorField
            id="bg-hex"
            label="Color"
            ariaLabel="Background color"
            value={palette.background}
            fallback={defaults.background}
            onChange={(background) => setPalette({ background })}
          />
          <PresetRow
            ariaLabel="Background presets"
            presets={CANVAS_PRESETS}
            selected={normalizeCssHex(palette.background) ?? defaults.background}
            onPick={(background) => setPalette({ background })}
          />
          <ImageRow
            image={palette.backgroundImage}
            onUpload={(file) => onImageUpload(file, "backgroundImage")}
            onClear={() => setPalette({ backgroundImage: null })}
          />
        </Section>

        <Section title="NODE BACKGROUND">
          <HexColorField
            id="node-fill-hex"
            label="Color"
            ariaLabel="Node background color"
            value={palette.nodeFill}
            fallback={defaults.nodeFill}
            onChange={(nodeFill) => setPalette({ nodeFill })}
          />
          <PresetRow
            ariaLabel="Node background presets"
            presets={NODE_FILL_PRESETS}
            selected={normalizeCssHex(palette.nodeFill) ?? defaults.nodeFill}
            onPick={(nodeFill) => setPalette({ nodeFill })}
          />
          <ImageRow
            image={palette.nodeBackgroundImage}
            onUpload={(file) => onImageUpload(file, "nodeBackgroundImage")}
            onClear={() => setPalette({ nodeBackgroundImage: null })}
          />
        </Section>
      </div>

      <footer class="style-rail-footer">
        <button type="button" class="btn" onClick={resetStyle}>
          Reset style
        </button>
      </footer>
    </aside>
  );
}

function Section(props: { title: string; children: ComponentChildren }): JSX.Element {
  return (
    <section class="style-section">
      <h3 class="style-section-title">{props.title}</h3>
      {props.children}
    </section>
  );
}

interface Choice {
  key: string;
  label: string;
  pressed: boolean;
  onClick: () => void;
  icon?: () => JSX.Element;
  ariaLabel?: string;
}

function ChoiceGroup(props: { ariaLabel: string; cols?: 2 | 4; items: Choice[] }): JSX.Element {
  return (
    <div class={props.cols ? `shape-group cols-${props.cols}` : "shape-group"} role="group" aria-label={props.ariaLabel}>
      {props.items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            class="shape-btn"
            aria-label={item.ariaLabel}
            aria-pressed={item.pressed}
            onClick={item.onClick}
          >
            {Icon ? (
              <span class="shape-icon">
                <Icon />
              </span>
            ) : null}
            <span class="shape-label">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PresetRow(props: {
  ariaLabel: string;
  presets: readonly CanvasPreset[];
  selected: string;
  onPick: (hex: string) => void;
}): JSX.Element {
  return (
    <div class="color-presets" role="group" aria-label={props.ariaLabel}>
      {props.presets.map(({ hex, label }) => (
        <button
          key={hex}
          type="button"
          class="color-preset"
          style={{ "--swatch": hex } as JSX.CSSProperties}
          aria-label={label}
          aria-pressed={props.selected === hex}
          title={label}
          onClick={() => props.onPick(hex)}
        />
      ))}
    </div>
  );
}

function ImageRow(props: {
  image: string | null;
  onUpload: (file: File | undefined) => void;
  onClear: () => void;
}): JSX.Element {
  return (
    <div class="image-row">
      <label class="btn btn-primary">
        Upload image
        <input type="file" accept="image/*" hidden onChange={(e) => props.onUpload(e.currentTarget.files?.[0])} />
      </label>
      {props.image ? (
        <button type="button" class="btn" onClick={props.onClear}>
          Clear
        </button>
      ) : null}
    </div>
  );
}

interface HexColorFieldProps {
  id: string;
  label: string;
  ariaLabel: string;
  value: string;
  fallback: string;
  onChange: (hex: string) => void;
}

function HexColorField(props: HexColorFieldProps): JSX.Element {
  const hex = normalizeCssHex(props.value) ?? props.fallback;
  const [hexDraft, setHexDraft] = useState(hex);
  const [hexInvalid, setHexInvalid] = useState(false);

  useEffect(() => {
    setHexDraft(hex);
    setHexInvalid(false);
  }, [hex]);

  function apply(raw: string, persistInvalid: boolean, rewriteDraft: boolean): void {
    const next = normalizeCssHex(raw);
    if (next) {
      if (rewriteDraft) setHexDraft(next);
      setHexInvalid(false);
      if (next !== props.value) props.onChange(next);
      return;
    }
    if (persistInvalid) setHexInvalid(true);
  }

  return (
    <>
      <label class="color-field-label" for={props.id}>{props.label}</label>
      <div class="color-field">
        <label class="color-swatch" style={{ "--swatch": hex } as JSX.CSSProperties} title="Pick a custom color">
          <span class="color-swatch-fill" />
          <input
            type="color"
            class="color-swatch-native"
            value={hex}
            aria-label={props.ariaLabel}
            onInput={(e) => apply(e.currentTarget.value, false, true)}
          />
        </label>
        <input
          id={props.id}
          type="text"
          class="color-hex"
          value={hexDraft}
          spellcheck={false}
          autocomplete="off"
          autocapitalize="off"
          maxlength={7}
          aria-label={`${props.ariaLabel} hex`}
          aria-invalid={hexInvalid}
          placeholder="#1a1a1a"
          onInput={(e) => {
            const raw = e.currentTarget.value;
            setHexDraft(raw);
            apply(raw, false, false);
          }}
          onBlur={() => apply(hexDraft, true, true)}
        />
      </div>
    </>
  );
}
