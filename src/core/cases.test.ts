import { describe, expect, it } from "vitest";

import { clampCaseIndex, groupTestCases } from "./cases.js";

describe("groupTestCases", () => {
  it("groups a one-parameter buffer by case count", () => {
    expect(groupTestCases("[4,2,7,1,3,6,9]\n[2,1,3]\n[]", 3, 1)).toEqual({
      cases: ["[4,2,7,1,3,6,9]", "[2,1,3]", "[]"],
    });
  });

  it("groups a multi-parameter buffer by case and param counts", () => {
    expect(groupTestCases("[2,7,11,15]\n9\n[3,2,4]\n6\n[3,3]\n6", 3, 2)).toEqual({
      cases: ["[2,7,11,15]\n9", "[3,2,4]\n6", "[3,3]\n6"],
    });
  });

  it("treats the full buffer as one case when there are no case tabs", () => {
    expect(groupTestCases("[1,2,3]\n2", 0, 2)).toEqual({
      cases: ["[1,2,3]\n2"],
    });
  });

  it("infers params from line count when locator count is missing", () => {
    expect(groupTestCases("[a]\n1\n[b]\n2", 2, 0)).toEqual({
      cases: ["[a]\n1", "[b]\n2"],
    });
  });

  it("returns a capture error when counts do not divide cleanly", () => {
    expect(groupTestCases("[1]\n[2]\n[3]", 2, 2)).toEqual({
      cases: [],
      captureError: "Could not separate test cases (2 cases × 2 params, found 3 lines).",
    });
  });

  it("returns empty cases for an empty buffer", () => {
    expect(groupTestCases("  \n", 0, 0)).toEqual({ cases: [] });
  });
});

describe("clampCaseIndex", () => {
  it("clamps to the last available case", () => {
    expect(clampCaseIndex(5, 3)).toBe(2);
    expect(clampCaseIndex(-1, 3)).toBe(0);
    expect(clampCaseIndex(1, 0)).toBe(0);
  });
});
