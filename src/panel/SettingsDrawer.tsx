import type { JSX } from "preact";
import {
  DEFAULT_SETTINGS,
  EDGE_STYLES,
  NODE_SHAPES,
  RANK_DIRS,
  SPLINES,
  THEME_MODES,
  type EdgeStyle,
  type NodeShape,
  type Palette,
  type RankDir,
  type Settings,
  type Splines,
  type ThemeMode,
} from "../settings/schema.js";

interface Props {
  settings: Settings;
  /** Which palette the current theme resolves to, so edits land on the right one. */
  activePalette: "light" | "dark";
  onChange: (next: Settings) => void;
}

const RANKDIR_LABELS: Record<RankDir, string> = {
  TB: "Top to bottom",
  LR: "Left to right",
  BT: "Bottom to top",
  RL: "Right to left",
};

const COLOR_FIELDS: Array<[keyof Palette, string]> = [
  ["background", "Canvas"],
  ["nodeFill", "Node fill"],
  ["nodeStroke", "Node border"],
  ["nodeText", "Node text"],
  ["rootFill", "Root fill"],
  ["rootStroke", "Root border"],
  ["edgeColor", "Edge"],
  ["edgeText", "Edge label"],
  ["cycleColor", "Cycle"],
  ["terminalText", "Null / tail"],
  ["cellFill", "Cell (set)"],
  ["cellEmptyFill", "Cell (unset)"],
  ["cellStroke", "Cell border"],
  ["cellText", "Cell text"],
];

export function SettingsDrawer({ settings, activePalette, onChange }: Props): JSX.Element {
  const layout = settings.layout;
  const palette = settings[activePalette];

  const setLayout = <K extends keyof typeof layout>(key: K, value: (typeof layout)[K]): void => {
    onChange({ ...settings, layout: { ...layout, [key]: value } });
  };
  const setColor = (key: keyof Palette, value: string): void => {
    onChange({ ...settings, [activePalette]: { ...palette, [key]: value } });
  };

  return (
    <div class="drawer">
      <fieldset class="group">
        <legend>Theme</legend>
        <Row label="Follow LeetCode">
          <select value={settings.mode} onChange={(e) => onChange({ ...settings, mode: e.currentTarget.value as ThemeMode })}>
            {THEME_MODES.map((m) => <option value={m}>{m}</option>)}
          </select>
        </Row>
        <div class="swatches">
          {COLOR_FIELDS.map(([key, label]) => (
            <Row label={label}>
              <input type="color" value={palette[key]} onInput={(e) => setColor(key, e.currentTarget.value)} />
            </Row>
          ))}
        </div>
      </fieldset>

      <fieldset class="group">
        <legend>Nodes and edges</legend>
        <Row label="Node shape">
          <select value={layout.nodeShape} onChange={(e) => setLayout("nodeShape", e.currentTarget.value as NodeShape)}>
            {NODE_SHAPES.map((s) => <option value={s}>{s}</option>)}
          </select>
        </Row>
        <Row label="Edge style">
          <select value={layout.edgeStyle} onChange={(e) => setLayout("edgeStyle", e.currentTarget.value as EdgeStyle)}>
            {EDGE_STYLES.map((s) => <option value={s}>{s}</option>)}
          </select>
        </Row>
        <Row label="Edge routing">
          <select value={layout.splines} onChange={(e) => setLayout("splines", e.currentTarget.value as Splines)}>
            {SPLINES.map((s) => <option value={s}>{s}</option>)}
          </select>
        </Row>
        <Row label="Arrowheads">
          <input type="checkbox" checked={layout.showArrowheads} onChange={(e) => setLayout("showArrowheads", e.currentTarget.checked)} />
        </Row>
        <Row label={`Line weight  ${layout.penWidth.toFixed(1)}`}>
          <input type="range" min="0.5" max="4" step="0.1" value={layout.penWidth}
            onInput={(e) => setLayout("penWidth", Number(e.currentTarget.value))} />
        </Row>
      </fieldset>

      <fieldset class="group">
        <legend>Layout</legend>
        <Row label="Direction">
          <select value={layout.rankdir} onChange={(e) => setLayout("rankdir", e.currentTarget.value as RankDir)}>
            {RANK_DIRS.map((value) => <option value={value}>{RANKDIR_LABELS[value]}</option>)}
          </select>
        </Row>
        <Row label={`Node spacing  ${layout.nodeSep.toFixed(2)}`}>
          <input type="range" min="0.1" max="1.5" step="0.05" value={layout.nodeSep}
            onInput={(e) => setLayout("nodeSep", Number(e.currentTarget.value))} />
        </Row>
        <Row label={`Level spacing  ${layout.rankSep.toFixed(2)}`}>
          <input type="range" min="0.1" max="2" step="0.05" value={layout.rankSep}
            onInput={(e) => setLayout("rankSep", Number(e.currentTarget.value))} />
        </Row>
        <Row label={`Font size  ${layout.fontSize}`}>
          <input type="range" min="8" max="24" step="1" value={layout.fontSize}
            onInput={(e) => setLayout("fontSize", Number(e.currentTarget.value))} />
        </Row>
        <Row label="Font">
          <input type="text" value={layout.fontFamily} onChange={(e) => setLayout("fontFamily", e.currentTarget.value)} />
        </Row>
      </fieldset>

      <fieldset class="group">
        <legend>Detail</legend>
        <Row label="Show null children">
          <input type="checkbox" checked={layout.showNullChildren} onChange={(e) => setLayout("showNullChildren", e.currentTarget.checked)} />
        </Row>
        <Row label="Show list terminator">
          <input type="checkbox" checked={layout.showListTerminal} onChange={(e) => setLayout("showListTerminal", e.currentTarget.checked)} />
        </Row>
        <Row label="Show grid indices">
          <input type="checkbox" checked={layout.showMatrixIndices} onChange={(e) => setLayout("showMatrixIndices", e.currentTarget.checked)} />
        </Row>
        <Row label="Update while typing">
          <input type="checkbox" checked={settings.liveUpdate} onChange={(e) => onChange({ ...settings, liveUpdate: e.currentTarget.checked })} />
        </Row>
        <Row label="Open automatically">
          <input type="checkbox" checked={settings.autoOpen} onChange={(e) => onChange({ ...settings, autoOpen: e.currentTarget.checked })} />
        </Row>
        <Row label="Warn above N nodes">
          <input type="number" min="50" max="5000" step="50" value={settings.nodeLimit}
            onChange={(e) => {
              const n = Number(e.currentTarget.value);
              if (!Number.isFinite(n)) return;
              onChange({ ...settings, nodeLimit: Math.min(5000, Math.max(50, Math.round(n))) });
            }} />
        </Row>
      </fieldset>

      <div class="footer-actions">
        <button class="ghost-btn" onClick={() => onChange({ ...DEFAULT_SETTINGS, mode: settings.mode })}>
          Reset to defaults
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: JSX.Element }): JSX.Element {
  return (
    <div class="row">
      <label>{label}</label>
      {children}
    </div>
  );
}
