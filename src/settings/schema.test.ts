import { describe, expect, it } from "vitest";

import { DARK, DEFAULT_LAYOUT, DEFAULT_SETTINGS, LIGHT, withDefaults } from "./schema.js";

describe("withDefaults", () => {
  it("falls back to defaults for retired node shapes and edge styles", () => {
    for (const [nodeShape, edgeStyle] of [["hexagon", "bold"], ["ellipse", "dotted"], ["box", "dashed"]] as const) {
      const { layout } = withDefaults({ layout: { nodeShape, edgeStyle } });
      expect(layout.nodeShape).toBe(DEFAULT_LAYOUT.nodeShape);
      expect(layout.edgeStyle).toBe(edgeStyle === "bold" ? DEFAULT_LAYOUT.edgeStyle : edgeStyle);
    }
  });

  it("uses defaults for invalid layout enums and booleans", () => {
    const settings = withDefaults({
      mode: "sepia",
      autoOpen: "yes",
      layout: {
        nodeShape: "not-a-shape",
        edgeStyle: 7,
        splines: null,
        rankdir: "sideways",
        showNullChildren: "true",
        showListTerminal: 0,
        showMatrixIndices: "false",
        showArrowheads: undefined,
      },
    });

    expect(settings.mode).toBe(DEFAULT_SETTINGS.mode);
    expect(settings.autoOpen).toBe(DEFAULT_SETTINGS.autoOpen);
    expect(settings.layout.nodeShape).toBe(DEFAULT_LAYOUT.nodeShape);
    expect(settings.layout.edgeStyle).toBe(DEFAULT_LAYOUT.edgeStyle);
    expect(settings.layout.splines).toBe(DEFAULT_LAYOUT.splines);
    expect(settings.layout.rankdir).toBe(DEFAULT_LAYOUT.rankdir);
    expect(settings.layout.showNullChildren).toBe(DEFAULT_LAYOUT.showNullChildren);
    expect(settings.layout.showListTerminal).toBe(DEFAULT_LAYOUT.showListTerminal);
    expect(settings.layout.showMatrixIndices).toBe(DEFAULT_LAYOUT.showMatrixIndices);
    expect(settings.layout.showArrowheads).toBe(DEFAULT_LAYOUT.showArrowheads);
  });

  it("does not spread malformed primitive settings bags", () => {
    const settings = withDefaults("malformed");

    expect(settings).toEqual(DEFAULT_SETTINGS);
  });

  it("measures labels in the rendered font, migrating the retired Outfit setting", () => {
    expect(DEFAULT_LAYOUT.fontFamily).toBe("Inter Tight");
    expect(withDefaults({ layout: { fontFamily: "Outfit" } }).layout.fontFamily).toBe("Inter Tight");
  });

  it("replaces colors still on the retired indigo defaults with the brand palette", () => {
    const settings = withDefaults({
      light: { background: "#FFFFFF", nodeFill: "#eef2ff", nodeStroke: "#4f46e5", nodeText: "#1e1b4b" },
      dark: { background: "#1a1a1a", nodeFill: "#312e81", edgeColor: "#94a3b8", nodeText: "#e0e7ff" },
    });

    expect(settings.light).toEqual(LIGHT);
    expect(settings.dark).toEqual(DARK);
  });

  it("keeps colors the user picked and normalizes their hex form", () => {
    const settings = withDefaults({
      light: { background: "#ABC", nodeFill: "#123456", backgroundImage: "data:image/png;base64,AA" },
      dark: { edgeColor: "#FEDCBA", nodeFill: "not a color" },
    });

    expect(settings.light.background).toBe("#aabbcc");
    expect(settings.light.nodeFill).toBe("#123456");
    expect(settings.light.backgroundImage).toBe("data:image/png;base64,AA");
    expect(settings.dark.edgeColor).toBe("#fedcba");
    expect(settings.dark.nodeFill).toBe(DARK.nodeFill);
  });
});
