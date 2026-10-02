export interface CanvasPreset {
  hex: string;
  label: string;
}

export const CANVAS_PRESETS: readonly CanvasPreset[] = [
  { hex: "#fdf7f1", label: "Paper" },
  { hex: "#f6e9d5", label: "Cream" },
  { hex: "#e0d9d2", label: "Stone" },
  { hex: "#312d28", label: "Graphite" },
  { hex: "#1a1815", label: "Ink" },
  { hex: "#0e101f", label: "Night" },
];

export const NODE_FILL_PRESETS: readonly CanvasPreset[] = [
  { hex: "#f1e5ff", label: "Lilac" },
  { hex: "#d8bcfa", label: "Violet" },
  { hex: "#7031a6", label: "Plum" },
  { hex: "#3f2956", label: "Aubergine" },
  { hex: "#f0dfc4", label: "Sand" },
  { hex: "#fdf7f1", label: "Paper" },
];

export const EDGE_PRESETS: readonly CanvasPreset[] = [
  { hex: "#7b736c", label: "Stone" },
  { hex: "#312620", label: "Ink" },
  { hex: "#7031a6", label: "Plum" },
  { hex: "#8f8c87", label: "Ash" },
  { hex: "#b88fe6", label: "Lilac" },
  { hex: "#b6522d", label: "Rust" },
];

export function normalizeCssHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const hex = value.trim().toLowerCase().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  return null;
}
