import { describe, expect, it } from "vitest";

import { DEFAULT_LAYOUT, DEFAULT_SETTINGS, withDefaults } from "./schema.js";

describe("withDefaults", () => {
  it("uses defaults for invalid layout enums and booleans", () => {
    const settings = withDefaults({
      mode: "sepia",
      autoOpen: "yes",
      liveUpdate: 1,
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
    expect(settings.liveUpdate).toBe(DEFAULT_SETTINGS.liveUpdate);
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
});
