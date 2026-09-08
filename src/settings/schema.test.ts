import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, NODE_LIMIT, withDefaults } from "./schema.js";

describe("theme mode", () => {
  it("defaults to dark on first launch", () => {
    expect(DEFAULT_SETTINGS.mode).toBe("dark");
    expect(withDefaults(undefined).mode).toBe("dark");
  });

  it("keeps a saved light or dark mode", () => {
    expect(withDefaults({ mode: "light" }).mode).toBe("light");
    expect(withDefaults({ mode: "dark" }).mode).toBe("dark");
  });

  it("treats the old auto mode as dark", () => {
    expect(withDefaults({ mode: "auto" }).mode).toBe("dark");
  });
});

describe("node limit", () => {
  it("caps graphs at 100 nodes", () => {
    expect(NODE_LIMIT).toBe(100);
    expect(DEFAULT_SETTINGS.nodeLimit).toBe(100);
    expect(withDefaults({ nodeLimit: 400 }).nodeLimit).toBe(100);
  });
});

describe("node label size", () => {
  it("uses 16pt labels by default", () => {
    expect(DEFAULT_SETTINGS.layout.fontSize).toBe(16);
    expect(withDefaults(undefined).layout.fontSize).toBe(16);
  });

  it("lifts the previous 13pt default so stored settings get larger labels", () => {
    expect(withDefaults({ layout: { ...DEFAULT_SETTINGS.layout, fontSize: 13 } }).layout.fontSize).toBe(16);
  });

  it("refreshes the previous default label colors for contrast", () => {
    const next = withDefaults({
      light: { ...DEFAULT_SETTINGS.light, nodeText: "#1e1b4b" },
      dark: { ...DEFAULT_SETTINGS.dark, nodeText: "#e0e7ff" },
    });
    expect(next.light.nodeText).toBe("#111827");
    expect(next.dark.nodeText).toBe("#ffffff");
  });
});
