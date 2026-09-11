export interface CanvasPreset {
  hex: string;
  label: string;
}

export const CANVAS_PRESETS: readonly CanvasPreset[] = [
  { hex: "#ffffff", label: "White" },
  { hex: "#f4f6fa", label: "Paper" },
  { hex: "#e7e4dc", label: "Warm" },
  { hex: "#1e293b", label: "Slate" },
  { hex: "#1a1a1a", label: "Ink" },
  { hex: "#0b1220", label: "Night" },
];

export const NODE_FILL_PRESETS: readonly CanvasPreset[] = [
  { hex: "#eef2ff", label: "Ice" },
  { hex: "#c7d2fe", label: "Periwinkle" },
  { hex: "#4f46e5", label: "Indigo" },
  { hex: "#312e81", label: "Deep" },
  { hex: "#1e293b", label: "Slate" },
  { hex: "#ffffff", label: "White" },
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
