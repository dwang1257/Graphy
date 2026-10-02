import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "./schema.js";
import { sameSettings } from "./split.js";

describe("sameSettings", () => {
  it("compares style by value and images by identity of their data", () => {
    const image = "data:image/png;base64,abc";
    const a = { ...DEFAULT_SETTINGS, light: { ...DEFAULT_SETTINGS.light, backgroundImage: image } };
    const b = { ...DEFAULT_SETTINGS, light: { ...DEFAULT_SETTINGS.light, backgroundImage: `${image}` } };
    expect(sameSettings(a, b)).toBe(true);
    expect(sameSettings(a, { ...b, mode: "light" })).toBe(false);
    expect(sameSettings(a, { ...b, light: { ...b.light, backgroundImage: null } })).toBe(false);
    expect(sameSettings(a, { ...b, layout: { ...b.layout, nodeShape: "square" } })).toBe(false);
  });
});
