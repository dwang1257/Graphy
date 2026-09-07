export interface CanvasPreset {
  hex: string;
  label: string;
}

/** Neutral stage fills. First and fifth match LIGHT / DARK defaults. */
export const CANVAS_PRESETS: readonly CanvasPreset[] = [
  { hex: "#ffffff", label: "White" },
  { hex: "#f4f6fa", label: "Paper" },
  { hex: "#e7e4dc", label: "Warm" },
  { hex: "#1e293b", label: "Slate" },
  { hex: "#1a1a1a", label: "Ink" },
  { hex: "#0b1220", label: "Night" },
];

/** `#rgb` / `#rrggbb` (hash optional) → `#rrggbb`, or null if the native picker cannot use it. */
export function normalizeCssHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  const hex = raw.startsWith("#") ? raw.slice(1) : raw;
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
  }
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  return null;
}
