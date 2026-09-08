import type { Layout, Palette } from "../settings/schema.js";

/** Palette fields applied as CSS / GraphView overlay — they must not rebuild DOT. */
export const CSS_ONLY_PALETTE_KEYS = ["background", "backgroundImage", "nodeBackgroundImage"] as const;

/**
 * Debounce for settings/style-driven emitDot. Longer than the 120ms renderDot
 * timer so slider onInput does not serialize DOT on every tick; shorter than
 * the 300ms settings persist so the graph updates before the write lands.
 */
export const SETTINGS_DOT_DEBOUNCE_MS = 200;

/** Stable identity of palette + layout fields that Graphviz actually reads. */
export function dotStyleKey(palette: Palette, layout: Layout): string {
  const forDot: Partial<Palette> = { ...palette };
  for (const key of CSS_ONLY_PALETTE_KEYS) delete forDot[key];
  return JSON.stringify({ palette: forDot, layout });
}
