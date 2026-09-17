import { describe, expect, it } from "vitest";

import {
  MAX_INPUT_LENGTH,
  MAX_INPUT_VALUES,
  MAX_VALUE_DEPTH,
  parseInput,
  scanInputValues,
  splitInputValues,
} from "./value.js";

describe("splitInputValues", () => {
  it("keeps a pretty-printed nested array as one value", () => {
    const raw = "[\n  [1, 2],\n  [3, 4]\n]\n2";
    expect(splitInputValues(raw)).toEqual(["[\n  [1, 2],\n  [3, 4]\n]", "2"]);
  });

  it("does not split on brackets that live inside strings", () => {
    expect(splitInputValues('["a[b]", "c"]\n1')).toEqual(['["a[b]", "c"]', "1"]);
  });
});

describe("parseInput", () => {
  it("parses pretty-printed arrays as JSON", () => {
    expect(parseInput("[\n  1,\n  null,\n  2\n]")).toEqual([[1, null, 2]]);
  });

  it("accepts Python literals that show up in custom testcases", () => {
    expect(parseInput("[1, None, 2]\nTrue")).toEqual([[1, null, 2], true]);
  });

  it("does not normalize Python tokens inside strings", () => {
    expect(parseInput('["None", None, "True", True]')).toEqual([
      ["None", null, "True", true],
    ]);
  });
});

describe("scanInputValues", () => {
  it("reports an unmatched delimiter without discarding scanned text", () => {
    expect(scanInputValues("[1, 2")).toEqual({
      values: ["[1, 2"],
      error: "Unclosed delimiter '['.",
    });
  });

  it("reports mismatched closing delimiters", () => {
    expect(scanInputValues("[1, 2}")).toEqual({
      values: ["[1, 2}"],
      error: "Mismatched delimiter '}'.",
    });
  });

  it("reports an unterminated string", () => {
    expect(scanInputValues('"unterminated')).toEqual({
      values: ["\"unterminated"],
      error: "Unclosed string.",
    });
  });

  it("rejects input before scanning when the buffer is oversized", () => {
    const result = scanInputValues("x".repeat(MAX_INPUT_LENGTH + 1));
    expect(result.values).toEqual([]);
    expect(result.error).toContain("Input is too large");
  });

  it("rejects too many top-level values", () => {
    const result = scanInputValues(Array.from({ length: MAX_INPUT_VALUES + 1 }, () => "1").join("\n"));
    expect(result.values).toHaveLength(MAX_INPUT_VALUES);
    expect(result.error).toContain("too many values");
  });

  it("rejects deeply nested values before parsing", () => {
    const result = scanInputValues("[".repeat(MAX_VALUE_DEPTH + 1) + "0" + "]".repeat(MAX_VALUE_DEPTH + 1));
    expect(result.values).toEqual([]);
    expect(result.error).toContain("nested");
  });
});
