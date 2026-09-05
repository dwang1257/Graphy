import type { JSX } from "preact";
import {
  DEFAULT_LAYOUT,
  DARK,
  LIGHT,
  type NodeShape,
  type Palette,
  type Settings,
  type ThemeMode,
} from "../settings/schema.js";
import { CloseIcon } from "./icons.js";

interface Props {
  settings: Settings;
  activePalette: "light" | "dark";
  onChange: (next: Settings) => void;
  onClose: () => void;
}

const SHAPES: Array<{ value: NodeShape; label: string; icon: string }> = [
  { value: "circle", label: "Circle", icon: "○" },
  { value: "box", label: "Box", icon: "□" },
  { value: "diamond", label: "Diamond", icon: "◇" },
];

const MODES: Array<{ value: ThemeMode; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

const NODE_SIZE_MIN = 0.85;
const NODE_SIZE_MAX = 1.2;

export function SettingsDrawer({ settings, activePalette, onChange, onClose }: Props): JSX.Element {
  const layout = settings.layout;
  const palette = settings[activePalette];

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
    const defaults = activePalette === "light" ? LIGHT : DARK;
    onChange({
      ...settings,
      layout: {
        ...layout,
        nodeShape: DEFAULT_LAYOUT.nodeShape,
        nodeSize: DEFAULT_LAYOUT.nodeSize,
      },
      [activePalette]: {
        ...palette,
        background: defaults.background,
        backgroundImage: defaults.backgroundImage,
        nodeBackgroundImage: defaults.nodeBackgroundImage,
      },
    });
  };

  return (
    <aside class="style-rail" role="dialog" aria-label="Style your graph">
      <header class="style-rail-header">
        <h2 class="style-rail-title">Style your graph</h2>
        <button class="icon-btn" type="button" aria-label="Close style panel" onClick={onClose}>
          <CloseIcon />
        </button>
      </header>

      <div class="style-rail-body">
        <section class="style-section">
          <h3 class="style-section-title">Appearance</h3>
          <div class="shape-group" role="group" aria-label="Color mode">
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
          <h3 class="style-section-title">Node shape</h3>
          <div class="shape-group" role="group" aria-label="Node shape">
            {SHAPES.map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                class="shape-btn"
                aria-label={label}
                aria-pressed={layout.nodeShape === value}
                onClick={() => setLayout("nodeShape", value)}
              >
                <span class="shape-icon" aria-hidden="true">{icon}</span>
                <span class="shape-label">{label}</span>
              </button>
            ))}
          </div>
        </section>

        <section class="style-section">
          <h3 class="style-section-title">Node size</h3>
          <input
            type="range"
            class="size-slider"
            min={NODE_SIZE_MIN}
            max={NODE_SIZE_MAX}
            step="0.05"
            value={layout.nodeSize}
            aria-valuemin={NODE_SIZE_MIN}
            aria-valuemax={NODE_SIZE_MAX}
            aria-valuenow={layout.nodeSize}
            onInput={(e) => setLayout("nodeSize", Number(e.currentTarget.value))}
          />
          <div class="size-labels">
            <span>Small</span>
            <span>Medium</span>
            <span>Large</span>
          </div>
        </section>

        <section class="style-section">
          <h3 class="style-section-title">Stage background</h3>
          <p class="style-section-hint">Canvas color and image behind the graph</p>
          <div class="bg-row">
            <label class="bg-color-label" for="bg-color">Color</label>
            <input
              id="bg-color"
              type="color"
              class="bg-color-input"
              value={palette.background}
              onInput={(e) => setPalette({ background: e.currentTarget.value })}
            />
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
          <h3 class="style-section-title">Node background</h3>
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
