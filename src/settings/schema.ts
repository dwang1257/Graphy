import { normalizeCssHex } from "./cssColor.js";

export const NODE_SHAPES = ["circle", "square", "diamond"] as const;
export const EDGE_STYLES = ["solid", "dashed", "dotted"] as const;
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
  backgroundImage: string | null;
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
  autoOpen: boolean;
}

export const LIGHT: Palette = {
  background: "#fdf7f1",
  backgroundImage: null,
  nodeBackgroundImage: null,
  nodeFill: "#f1e5ff",
  nodeStroke: "#7031a6",
  nodeText: "#1e130e",
  rootFill: "#d8bcfa",
  rootStroke: "#571f84",
  terminalText: "#7b736c",
  edgeColor: "#7b736c",
  edgeText: "#544b45",
  cycleColor: "#c92420",
  cellFill: "#ddc4fc",
  cellEmptyFill: "#f5ede5",
  cellStroke: "#ccc2b8",
  cellText: "#1e130e",
  gutterText: "#7b736c",
};

export const DARK: Palette = {
  background: "#1a1815",
  backgroundImage: null,
  nodeBackgroundImage: null,
  nodeFill: "#3f2956",
  nodeStroke: "#b88fe6",
  nodeText: "#f5f1ec",
  rootFill: "#694191",
  rootStroke: "#d8bcfa",
  terminalText: "#83807b",
  edgeColor: "#8f8c87",
  edgeText: "#c7c4be",
  cycleColor: "#f47c6e",
  cellFill: "#543772",
  cellEmptyFill: "#262421",
  cellStroke: "#45423e",
  cellText: "#eeebe5",
  gutterText: "#898681",
};

type PaletteColorKey = Exclude<keyof Palette, "backgroundImage" | "nodeBackgroundImage">;

const RETIRED_LIGHT: Record<PaletteColorKey, readonly string[]> = {
  background: ["#ffffff"],
  nodeFill: ["#eef2ff"],
  nodeStroke: ["#4f46e5"],
  nodeText: ["#111827", "#1e1b4b"],
  rootFill: ["#4f46e5"],
  rootStroke: ["#3730a3"],
  terminalText: ["#94a3b8"],
  edgeColor: ["#64748b"],
  edgeText: ["#475569"],
  cycleColor: ["#e11d48"],
  cellFill: ["#c7d2fe"],
  cellEmptyFill: ["#f8fafc"],
  cellStroke: ["#cbd5e1"],
  cellText: ["#1e293b"],
  gutterText: ["#94a3b8"],
};

const RETIRED_DARK: Record<PaletteColorKey, readonly string[]> = {
  background: ["#1a1a1a"],
  nodeFill: ["#312e81"],
  nodeStroke: ["#818cf8"],
  nodeText: ["#ffffff", "#e0e7ff"],
  rootFill: ["#6366f1"],
  rootStroke: ["#a5b4fc"],
  terminalText: ["#64748b"],
  edgeColor: ["#94a3b8"],
  edgeText: ["#cbd5e1"],
  cycleColor: ["#fb7185"],
  cellFill: ["#4338ca"],
  cellEmptyFill: ["#262626"],
  cellStroke: ["#404040"],
  cellText: ["#e5e7eb"],
  gutterText: ["#6b7280"],
};

const PALETTE_COLOR_KEYS = Object.keys(RETIRED_LIGHT) as PaletteColorKey[];

function paletteFrom(stored: unknown, defaults: Palette, retired: Record<PaletteColorKey, readonly string[]>): Palette {
  const source = asRecord(stored);
  const palette: Palette = { ...defaults };
  for (const key of PALETTE_COLOR_KEYS) {
    const value = normalizeCssHex(source[key]);
    palette[key] = value === null || retired[key].includes(value) ? defaults[key] : value;
  }
  palette.backgroundImage = imageUrl(source.backgroundImage, defaults.backgroundImage);
  palette.nodeBackgroundImage = imageUrl(source.nodeBackgroundImage, defaults.nodeBackgroundImage);
  return palette;
}

export const DEFAULT_LAYOUT: Layout = {
  nodeShape: "circle",
  nodeSize: 1,
  edgeStyle: "solid",
  splines: "spline",
  rankdir: "TB",
  fontFamily: "Inter Tight",
  fontSize: 16,
  penWidth: 1.4,
  nodeSep: 0.35,
  rankSep: 0.45,
  showNullChildren: false,
  showListTerminal: true,
  showMatrixIndices: true,
  showArrowheads: true,
};

export const NODE_LIMIT = 100;

export const DEFAULT_SETTINGS: Settings = {
  mode: "dark",
  light: LIGHT,
  dark: DARK,
  layout: DEFAULT_LAYOUT,
  autoOpen: true,
};

function num(v: unknown, fallback: number, min: number, max: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find((option) => option === value) ?? fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function imageUrl(v: unknown, fallback: string | null): string | null {
  if (v === null) return null;
  if (typeof v === "string" && v.length > 0) return v;
  return fallback;
}

function layoutFrom(stored: unknown): Layout {
  const source = asRecord(stored);
  const fontSize = num(source.fontSize, DEFAULT_LAYOUT.fontSize, 8, 24);
  return {
    ...DEFAULT_LAYOUT,
    ...source,
    nodeShape: enumValue(source.nodeShape, NODE_SHAPES, DEFAULT_LAYOUT.nodeShape),
    edgeStyle: enumValue(source.edgeStyle, EDGE_STYLES, DEFAULT_LAYOUT.edgeStyle),
    splines: enumValue(source.splines, SPLINES, DEFAULT_LAYOUT.splines),
    rankdir: enumValue(source.rankdir, RANK_DIRS, DEFAULT_LAYOUT.rankdir),
    showNullChildren: bool(source.showNullChildren, DEFAULT_LAYOUT.showNullChildren),
    showListTerminal: bool(source.showListTerminal, DEFAULT_LAYOUT.showListTerminal),
    showMatrixIndices: bool(source.showMatrixIndices, DEFAULT_LAYOUT.showMatrixIndices),
    showArrowheads: bool(source.showArrowheads, DEFAULT_LAYOUT.showArrowheads),
    fontSize: fontSize === 13 ? DEFAULT_LAYOUT.fontSize : fontSize,
    penWidth: num(source.penWidth, DEFAULT_LAYOUT.penWidth, 0.5, 4),
    nodeSep: num(source.nodeSep, DEFAULT_LAYOUT.nodeSep, 0.1, 1.5),
    rankSep: num(source.rankSep, DEFAULT_LAYOUT.rankSep, 0.1, 2),
    nodeSize: num(source.nodeSize, DEFAULT_LAYOUT.nodeSize, 0.6, 1.8),
    fontFamily: DEFAULT_LAYOUT.fontFamily,
  };
}

export function withDefaults(stored: unknown): Settings {
  const s = asRecord(stored);
  return {
    mode: enumValue(s.mode, THEME_MODES, DEFAULT_SETTINGS.mode),
    light: paletteFrom(s.light, LIGHT, RETIRED_LIGHT),
    dark: paletteFrom(s.dark, DARK, RETIRED_DARK),
    layout: layoutFrom(s.layout),
    autoOpen: bool(s.autoOpen, DEFAULT_SETTINGS.autoOpen),
  };
}
