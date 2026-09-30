import type { Layout, Palette } from "../settings/schema.js";

export const CSS_ONLY_PALETTE_KEYS = ["background", "backgroundImage", "nodeBackgroundImage"] as const;

export const SETTINGS_DOT_DEBOUNCE_MS = 200;

export function dotStyleKey(palette: Palette, layout: Layout): string {
  const forDot: Partial<Palette> = { ...palette };
  for (const key of CSS_ONLY_PALETTE_KEYS) delete forDot[key];
  return JSON.stringify({ palette: forDot, layout });
}
