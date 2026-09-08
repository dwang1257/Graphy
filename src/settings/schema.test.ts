import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS, withDefaults } from "./schema.js";

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
