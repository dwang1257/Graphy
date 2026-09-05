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
