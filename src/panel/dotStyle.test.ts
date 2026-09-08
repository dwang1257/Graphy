import { describe, expect, it } from "vitest";

import { DEFAULT_LAYOUT, LIGHT } from "../settings/schema.js";
import { CSS_ONLY_PALETTE_KEYS, SETTINGS_DOT_DEBOUNCE_MS, dotStyleKey } from "./dotStyle.js";

describe("dotStyleKey", () => {
  it("ignores CSS-only stage and node photo fields", () => {
    const base = dotStyleKey(LIGHT, DEFAULT_LAYOUT);
    expect(dotStyleKey({ ...LIGHT, background: "#ff0000" }, DEFAULT_LAYOUT)).toBe(base);
    expect(dotStyleKey({ ...LIGHT, backgroundImage: "data:image/png;base64,bg" }, DEFAULT_LAYOUT)).toBe(base);
    expect(dotStyleKey({ ...LIGHT, nodeBackgroundImage: "data:image/png;base64,node" }, DEFAULT_LAYOUT)).toBe(base);
  });

  it("changes when a Graphviz palette field changes", () => {
    const base = dotStyleKey(LIGHT, DEFAULT_LAYOUT);
    expect(dotStyleKey({ ...LIGHT, nodeFill: "#abcdef" }, DEFAULT_LAYOUT)).not.toBe(base);
    expect(dotStyleKey({ ...LIGHT, edgeColor: "#111111" }, DEFAULT_LAYOUT)).not.toBe(base);
  });

  it("changes when layout that Graphviz reads changes", () => {
    const base = dotStyleKey(LIGHT, DEFAULT_LAYOUT);
    expect(dotStyleKey(LIGHT, { ...DEFAULT_LAYOUT, nodeSize: 1.2 })).not.toBe(base);
    expect(dotStyleKey(LIGHT, { ...DEFAULT_LAYOUT, rankdir: "LR" })).not.toBe(base);
  });

  it("lists the CSS-only keys that must not force a relayout", () => {
    expect(CSS_ONLY_PALETTE_KEYS).toEqual(["background", "backgroundImage", "nodeBackgroundImage"]);
  });
});

describe("SETTINGS_DOT_DEBOUNCE_MS", () => {
  it("is long enough to coalesce slider onInput without matching the 120ms render timer", () => {
    expect(SETTINGS_DOT_DEBOUNCE_MS).toBeGreaterThan(120);
    expect(SETTINGS_DOT_DEBOUNCE_MS).toBeLessThanOrEqual(300);
  });
});
