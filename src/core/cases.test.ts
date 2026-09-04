import { describe, expect, it } from "vitest";

import { clampCaseIndex } from "./cases.js";

describe("clampCaseIndex", () => {
  it("clamps to the last available case", () => {
    expect(clampCaseIndex(5, 3)).toBe(2);
    expect(clampCaseIndex(-1, 3)).toBe(0);
    expect(clampCaseIndex(1, 0)).toBe(0);
  });
});
