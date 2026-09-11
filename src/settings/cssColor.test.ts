import { describe, expect, it } from "vitest";

import { CANVAS_PRESETS, NODE_FILL_PRESETS, normalizeCssHex } from "./cssColor.js";
import { DARK, LIGHT, withDefaults } from "./schema.js";

describe("normalizeCssHex", () => {
  it("expands 3-digit hex and accepts values without a hash", () => {
    expect(normalizeCssHex("#fff")).toBe("#ffffff");
    expect(normalizeCssHex("abc")).toBe("#aabbcc");
    expect(normalizeCssHex("  #1A1A1A  ")).toBe("#1a1a1a");
  });

  it("rejects colors the native picker cannot represent", () => {
    expect(normalizeCssHex("white")).toBeNull();
    expect(normalizeCssHex("#ffff")).toBeNull();
    expect(normalizeCssHex("")).toBeNull();
    expect(normalizeCssHex(12)).toBeNull();
  });
});

describe("canvas presets", () => {
  it("includes the light and dark stage defaults", () => {
    const hexes = CANVAS_PRESETS.map((preset) => preset.hex);
    expect(hexes).toContain(LIGHT.background);
    expect(hexes).toContain(DARK.background);
  });
});

describe("node fill presets", () => {
  it("includes the light and dark node fill defaults", () => {
    const hexes = NODE_FILL_PRESETS.map((preset) => preset.hex);
    expect(hexes).toContain(LIGHT.nodeFill);
    expect(hexes).toContain(DARK.nodeFill);
  });
});

describe("withDefaults background", () => {
  it("repairs a stored background that is not a 6-digit hex", () => {
    const next = withDefaults({
      light: { background: "white" },
      dark: { background: "#fff" },
    });
    expect(next.light.background).toBe(LIGHT.background);
    expect(next.dark.background).toBe("#ffffff");
  });
});
