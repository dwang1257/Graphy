import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";
import { CANVAS_PRESETS, normalizeCssHex } from "../settings/cssColor.js";
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

  const setLayout = <K extends keyof typeof layout>(key: K, value: (typeof layout)[K]): void => {
    onChange({ ...settings, layout: { ...layout, [key]: value } });
  };

  const setPalette = (patch: Partial<Palette>): void => {
    onChange({ ...settings, [activePalette]: { ...palette, ...patch } });
  };

  const onImageUpload = (
    file: File | undefined,
    key: "backgroundImage" | "nodeBackgroundImage",
  ): void => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setPalette({ [key]: reader.result });
    };
    reader.readAsDataURL(file);
  };

  const resetStyle = (): void => {
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
        edgeColor: defaults.edgeColor,
      },
    });
  };

  return (
    <aside class="style-rail" role="dialog" aria-label="Style your graph">
      <header class="style-rail-header">
        <button class="icon-btn" type="button" aria-label="Close style panel" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      <div class="style-rail-body">
        <section class="style-section">
          <h3 class="style-section-title">APPEARANCE</h3>
          <div class="shape-group cols-2" role="group" aria-label="Color mode">
            {MODES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                class="shape-btn"
                aria-pressed={settings.mode === value}
                onClick={() => onChange({ ...settings, mode: value })}
              >
                <span class="shape-label">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section class="style-section">
          <h3 class="style-section-title">NODE SHAPE</h3>
          <div class="shape-group" role="group" aria-label="Node shape">
            {styleNodeShapes().map(([value, label]) => {
              const Icon = SHAPE_ICONS[value];
              return (
                <button
                  key={value}
                  type="button"
                  class="shape-btn"
                  aria-label={label}
                  aria-pressed={layout.nodeShape === value}
                  onClick={() => setLayout("nodeShape", value)}
                >
                  <span class="shape-icon">
                    <Icon />
                  </span>
                  <span class="shape-label">{label}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section class="style-section">
          <h3 class="style-section-title">EDGES</h3>
          <div class="shape-group cols-4" role="group" aria-label="Edge style">
            {styleEdgeStyles().map(([value, label]) => {
              const Icon = EDGE_ICONS[value];
              return (
                <button
                  key={value}
                  type="button"
                  class="shape-btn"
                  aria-label={label}
                  aria-pressed={layout.edgeStyle === value}
                  onClick={() => setLayout("edgeStyle", value)}
                >
                  <span class="shape-icon">
                    <Icon />
                  </span>
                  <span class="shape-label">{label}</span>
                </button>
              );
            })}
          </div>
          <HexColorField
            id="edge-hex"
            label="Color"
            ariaLabel="Edge color"
            value={palette.edgeColor}
            fallback={defaults.edgeColor}
            onChange={(edgeColor) => setPalette({ edgeColor })}
          />
          <label class="color-field-label">Arrows</label>
          <div class="shape-group cols-2" role="group" aria-label="Arrowheads">
            {(
              [
                [true, "On"],
                [false, "Off"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                class="shape-btn"
                aria-pressed={layout.showArrowheads === value}
                onClick={() => setLayout("showArrowheads", value)}
              >
                <span class="shape-label">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section class="style-section">
          <h3 class="style-section-title">BACKGROUND</h3>
          <HexColorField
            id="bg-hex"
            label="Color"
            ariaLabel="Background color"
            value={palette.background}
            fallback={defaults.background}
            onChange={(background) => setPalette({ background })}
          />
          <div class="color-presets" role="group" aria-label="Background presets">
            {CANVAS_PRESETS.map(({ hex: preset, label }) => (
              <button
                key={preset}
                type="button"
                class="color-preset"
                style={{ "--swatch": preset } as JSX.CSSProperties}
                aria-label={label}
                aria-pressed={(normalizeCssHex(palette.background) ?? defaults.background) === preset}
                title={label}
                onClick={() => setPalette({ background: preset })}
              />
            ))}
          </div>
          <div class="bg-image-row">
            <label class="btn btn-primary bg-upload-btn">
              Upload image
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onImageUpload(e.currentTarget.files?.[0], "backgroundImage")}
              />
            </label>
            {palette.backgroundImage && (
              <button type="button" class="btn" onClick={() => setPalette({ backgroundImage: null })}>
                Clear
              </button>
            )}
          </div>
        </section>

        <section class="style-section">
          <h3 class="style-section-title">NODE BACKGROUND</h3>
          <div class="node-bg-image-row">
            <label class="btn btn-primary node-bg-upload-btn">
              Upload image
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => onImageUpload(e.currentTarget.files?.[0], "nodeBackgroundImage")}
              />
            </label>
            {palette.nodeBackgroundImage && (
              <button
                type="button"
                class="btn"
                onClick={() => setPalette({ nodeBackgroundImage: null })}
              >
                Clear
              </button>
            )}
          </div>
        </section>
      </div>

      <footer class="style-rail-footer">
        <button type="button" class="btn" onClick={resetStyle}>
          Reset style
        </button>
      </footer>
    </aside>
  );
}

function HexColorField(props: {
  id: string;
  label: string;
  ariaLabel: string;
  value: string;
  fallback: string;
  onChange: (hex: string) => void;
}): JSX.Element {
  const hex = normalizeCssHex(props.value) ?? props.fallback;
  const [hexDraft, setHexDraft] = useState(hex);
  const [hexInvalid, setHexInvalid] = useState(false);

  useEffect(() => {
    setHexDraft(hex);
    setHexInvalid(false);
  }, [hex]);

  const commit = (raw: string, persistInvalid: boolean): void => {
    const next = normalizeCssHex(raw);
    if (next) {
      setHexDraft(next);
      setHexInvalid(false);
      if (next !== props.value) props.onChange(next);
      return;
    }
    if (persistInvalid) setHexInvalid(true);
  };

  return (
    <>
      <label class="color-field-label" for={props.id}>{props.label}</label>
      <div class="color-field">
        <label
          class="color-swatch"
          style={{ "--swatch": hex } as JSX.CSSProperties}
          title="Pick a custom color"
        >
          <span class="color-swatch-fill" />
          <input
            type="color"
            class="color-swatch-native"
            value={hex}
            aria-label={props.ariaLabel}
            onInput={(e) => commit(e.currentTarget.value, false)}
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
            const next = normalizeCssHex(raw);
            if (next) {
              setHexInvalid(false);
              if (next !== props.value) props.onChange(next);
            }
          }}
          onBlur={() => commit(hexDraft, true)}
        />
      </div>
    </>
  );
}
