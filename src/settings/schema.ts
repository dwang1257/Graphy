import { normalizeCssHex } from "./cssColor.js";

export const NODE_SHAPES = ["circle", "ellipse", "box", "square", "diamond", "hexagon", "doublecircle", "plaintext"] as const;
export const EDGE_STYLES = ["solid", "dashed", "dotted", "bold"] as const;
export const SPLINES = ["spline", "line", "polyline", "ortho", "curved"] as const;
export const RANK_DIRS = ["TB", "LR", "BT", "RL"] as const;
export const THEME_MODES = ["light", "dark"] as const;

export type NodeShape = (typeof NODE_SHAPES)[number];
export type EdgeStyle = (typeof EDGE_STYLES)[number];
export type Splines = (typeof SPLINES)[number];
export type RankDir = (typeof RANK_DIRS)[number];
export type ThemeMode = (typeof THEME_MODES)[number];

export interface Palette {
  background: string;
  /** Data URL for a stage background image, or null for color only. */
  backgroundImage: string | null;
  /** Data URL for a node fill/background image, or null for solid fills. */
  nodeBackgroundImage: string | null;
  nodeFill: string;
  nodeStroke: string;
  nodeText: string;
  rootFill: string;
  rootStroke: string;
  terminalText: string;
  edgeColor: string;
  edgeText: string;
  cycleColor: string;
  cellFill: string;
  cellEmptyFill: string;
  cellStroke: string;
  cellText: string;
  gutterText: string;
}

export interface Layout {
  nodeShape: NodeShape;
  /** Visual scale multiplier for node size (font and dimensions). */
  nodeSize: number;
  edgeStyle: EdgeStyle;
  splines: Splines;
  rankdir: RankDir;
  fontFamily: string;
  fontSize: number;
  penWidth: number;
  nodeSep: number;
  rankSep: number;
  showNullChildren: boolean;
  showListTerminal: boolean;
  showMatrixIndices: boolean;
  showArrowheads: boolean;
}

export interface Settings {
  mode: ThemeMode;
  light: Palette;
  dark: Palette;
  layout: Layout;
  /** Open the panel automatically when a problem page loads. */
  autoOpen: boolean;
  /** Re-render while typing rather than only on Run. */
  liveUpdate: boolean;
  /** Hard cap on visible nodes. Graphs larger than this show an error. */
  nodeLimit: number;
}

export const LIGHT: Palette = {
  background: "#ffffff",
  backgroundImage: null,
  nodeBackgroundImage: null,
  nodeFill: "#eef2ff",
  nodeStroke: "#4f46e5",
  nodeText: "#111827",
  rootFill: "#4f46e5",
  rootStroke: "#3730a3",
  terminalText: "#94a3b8",
  edgeColor: "#64748b",
  edgeText: "#475569",
  cycleColor: "#e11d48",
  cellFill: "#c7d2fe",
  cellEmptyFill: "#f8fafc",
  cellStroke: "#cbd5e1",
  cellText: "#1e293b",
  gutterText: "#94a3b8",
};

export const DARK: Palette = {
  background: "#1a1a1a",
  backgroundImage: null,
  nodeBackgroundImage: null,
  nodeFill: "#312e81",
  nodeStroke: "#818cf8",
  nodeText: "#ffffff",
  rootFill: "#6366f1",
  rootStroke: "#a5b4fc",
  terminalText: "#64748b",
  edgeColor: "#94a3b8",
  edgeText: "#cbd5e1",
  cycleColor: "#fb7185",
  cellFill: "#4338ca",
  cellEmptyFill: "#262626",
  cellStroke: "#404040",
  cellText: "#e5e7eb",
  gutterText: "#6b7280",
};

export const DEFAULT_LAYOUT: Layout = {
  nodeShape: "circle",
  nodeSize: 1,
  edgeStyle: "solid",
  splines: "spline",
  rankdir: "TB",
  fontFamily: "Outfit",
  fontSize: 16,
  penWidth: 1.4,
  nodeSep: 0.35,
  rankSep: 0.45,
  showNullChildren: false,
  showListTerminal: true,
  showMatrixIndices: true,
  showArrowheads: true,
};

/** Graphs with more visible nodes than this are refused. */
export const NODE_LIMIT = 100;

export const DEFAULT_SETTINGS: Settings = {
  mode: "dark",
  light: LIGHT,
  dark: DARK,
  layout: DEFAULT_LAYOUT,
  autoOpen: true,
  liveUpdate: true,
  nodeLimit: NODE_LIMIT,
};

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

/** Accepts a non-empty string (typically a data URL), otherwise the fallback. */
function imageUrl(v: unknown, fallback: string | null): string | null {
  if (v === null) return null;
  if (typeof v === "string" && v.length > 0) return v;
  return fallback;
}

/**
 * Fills gaps left by older stored settings and clamps numbers, so a schema
 * addition or a bad stored value never breaks load.
 */
export function withDefaults(stored: unknown): Settings {
  const s = (stored ?? {}) as Partial<Settings>;
  const layout = { ...DEFAULT_LAYOUT, ...(s.layout ?? {}) };
  layout.fontSize = num(layout.fontSize, DEFAULT_LAYOUT.fontSize, 8, 24);
  // Lift the previous 13pt default so stored settings pick up the larger labels.
  if (layout.fontSize === 13) layout.fontSize = DEFAULT_LAYOUT.fontSize;
  layout.penWidth = num(layout.penWidth, DEFAULT_LAYOUT.penWidth, 0.5, 4);
  layout.nodeSep = num(layout.nodeSep, DEFAULT_LAYOUT.nodeSep, 0.1, 1.5);
  layout.rankSep = num(layout.rankSep, DEFAULT_LAYOUT.rankSep, 0.1, 2);
  layout.nodeSize = num(layout.nodeSize, DEFAULT_LAYOUT.nodeSize, 0.6, 1.8);
  layout.fontFamily = DEFAULT_LAYOUT.fontFamily;
  const light = { ...LIGHT, ...(s.light ?? {}) };
  const dark = { ...DARK, ...(s.dark ?? {}) };
  light.background = normalizeCssHex(light.background) ?? LIGHT.background;
  dark.background = normalizeCssHex(dark.background) ?? DARK.background;
  if (light.nodeText === "#1e1b4b") light.nodeText = LIGHT.nodeText;
  if (dark.nodeText === "#e0e7ff") dark.nodeText = DARK.nodeText;
  light.backgroundImage = imageUrl(light.backgroundImage, LIGHT.backgroundImage);
  dark.backgroundImage = imageUrl(dark.backgroundImage, DARK.backgroundImage);
  light.nodeBackgroundImage = imageUrl(light.nodeBackgroundImage, LIGHT.nodeBackgroundImage);
  dark.nodeBackgroundImage = imageUrl(dark.nodeBackgroundImage, DARK.nodeBackgroundImage);
  const mode: ThemeMode = s.mode === "light" || s.mode === "dark" ? s.mode : "dark";
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    mode,
    light,
    dark,
    layout,
    nodeLimit: NODE_LIMIT,
  };
}
