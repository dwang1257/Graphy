import { describe, expect, it } from "vitest";

import {
  MAX_INPUT_LENGTH,
  MAX_INPUT_VALUES,
  MAX_VALUE_DEPTH,
  parseInputResult,
  scanInputValues,
} from "./value.js";

describe("scanInputValues", () => {
  it("keeps a pretty-printed nested array as one value", () => {
    const raw = "[\n  [1, 2],\n  [3, 4]\n]\n2";
    expect(scanInputValues(raw)).toEqual({ values: ["[\n  [1, 2],\n  [3, 4]\n]", "2"] });
  });

  it("does not split on brackets that live inside strings", () => {
    expect(scanInputValues('["a[b]", "c"]\n1')).toEqual({ values: ['["a[b]", "c"]', "1"] });
  });
});

describe("parseInputResult", () => {
  it("parses pretty-printed arrays as JSON", () => {
    expect(parseInputResult("[\n  1,\n  null,\n  2\n]")).toEqual({ values: [[1, null, 2]] });
  });

  it("accepts Python literals that show up in custom testcases", () => {
    expect(parseInputResult("[1, None, 2]\nTrue")).toEqual({ values: [[1, null, 2], true] });
  });

  it("does not normalize Python tokens inside strings", () => {
    expect(parseInputResult('["None", None, "True", True]')).toEqual({
      values: [["None", null, "True", true]],
    });
  });

  it("reports malformed arrays instead of returning their raw text", () => {
    expect(parseInputResult("[1, nope]")).toEqual({
      values: [],
      error: "Invalid structured value.",
    });
  });

  it("reports malformed objects instead of returning their raw text", () => {
    expect(parseInputResult('{"value": nope}')).toEqual({
      values: [],
      error: "Invalid structured value.",
    });
  });

  it("reports valid JSON objects as unsupported values", () => {
    expect(parseInputResult('{"value": 1}')).toEqual({
      values: [],
      error: "Invalid structured value.",
    });
  });

  it("reports malformed arrays containing quoted values", () => {
    expect(parseInputResult('["hello", nope]')).toEqual({
      values: [],
      error: "Invalid structured value.",
    });
  });

  it("preserves quoted and unquoted scalar strings", () => {
    expect(parseInputResult('"hello"\nhello')).toEqual({
      values: ["hello", "hello"],
    });
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
