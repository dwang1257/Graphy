import { describe, expect, it } from "vitest";

import { clampCaseIndex, groupTestCases, pickCaseBuffers } from "./cases.js";

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

  it("drops trailing leftover values instead of failing the split", () => {
    expect(groupTestCases("[1]\n[2]\n[3]\ntrue", 3, 1)).toEqual({
      cases: ["[1]", "[2]", "[3]"],
    });
  });

  it("treats a selected-case buffer as one case when only that case is visible", () => {
    expect(groupTestCases("[2,7,11,15]\n9", 3, 2)).toEqual({
      cases: ["[2,7,11,15]\n9"],
    });
  });

  it("still yields a drawable case when counts do not divide cleanly", () => {
    const result = groupTestCases("[1]\n[2]\n[3]", 2, 2);
    expect(result.captureError).toBeUndefined();
    expect(result.cases.length).toBeGreaterThan(0);
    expect(result.cases.join("\n")).toContain("[1]");
  });

  it("groups pretty-printed arrays that span multiple lines", () => {
    const buffer = "[\n  1,\n  2,\n  3\n]\n[\n  4,\n  5\n]";
    expect(groupTestCases(buffer, 2, 1)).toEqual({
      cases: ["[\n  1,\n  2,\n  3\n]", "[\n  4,\n  5\n]"],
    });
  });

  it("splits two pretty-printed single-param cases from a long buffer", () => {
    const caseA = "[\n  1,\n  2,\n  3,\n  4,\n  5,\n  6,\n  7\n]";
    const caseB = "[\n  8,\n  9,\n  10,\n  11,\n  12,\n  13,\n  14,\n  15\n]";
    const buffer = `${caseA}\n${caseB}`;
    expect(groupTestCases(buffer, 2, 1)).toEqual({
      cases: [caseA, caseB],
    });
  });

  it("returns empty cases for an empty buffer", () => {
    expect(groupTestCases("  \n", 0, 0)).toEqual({ cases: [] });
  });
});

describe("pickCaseBuffers", () => {
  it("prefers the aggregate buffer over a duplicated selected-case editor", () => {
    const aggregate = "[4,2,7,1,3,6,9]\n[2,1,3]\n[]";
    const selected = "[4,2,7,1,3,6,9]";
    expect(pickCaseBuffers([selected, aggregate], 3, 1)).toEqual([aggregate]);
  });

  it("keeps one buffer per case tab when they already match", () => {
    expect(pickCaseBuffers(["[1]", "[2]"], 2, 1)).toEqual(["[1]", "[2]"]);
  });
});

describe("clampCaseIndex", () => {
  it("clamps to the last available case", () => {
    expect(clampCaseIndex(5, 3)).toBe(2);
    expect(clampCaseIndex(-1, 3)).toBe(0);
    expect(clampCaseIndex(1, 0)).toBe(0);
  });
});
