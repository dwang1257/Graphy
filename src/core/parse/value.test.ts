import { describe, expect, it } from "vitest";

import { parseInput, scanInputValues, splitInputValues } from "./value.js";

describe("splitInputValues", () => {
  it("keeps a pretty-printed nested array as one value", () => {
    const raw = "[\n  [1, 2],\n  [3, 4]\n]\n2";
    expect(splitInputValues(raw)).toEqual(["[\n  [1, 2],\n  [3, 4]\n]", "2"]);
  });

  it("keeps a pretty-printed tree array ahead of trailing args", () => {
    expect(splitInputValues("[\n  4,\n  2,\n  6\n]\n1\n2")).toEqual([
      "[\n  4,\n  2,\n  6\n]",
      "1",
      "2",
    ]);
  });

  it("does not split on brackets that live inside strings", () => {
    expect(splitInputValues('["a[b]", "c"]\n1')).toEqual(['["a[b]", "c"]', "1"]);
  });

  it("tracks parentheses while splitting multiline values", () => {
    expect(splitInputValues("(\n[1, 2]\n)\n3")).toEqual(["(\n[1, 2]\n)", "3"]);
  });

  it("does not end a string after an escaped backslash pair", () => {
    expect(splitInputValues('["\\\\", "]"]\n2')).toEqual(['["\\\\", "]"]', "2"]);
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

  it("parses single-quoted string literals", () => {
    expect(parseInput("'hello'")).toEqual(["hello"]);
  });

  it("does not strip trailing commas inside quoted strings", () => {
    expect(parseInput('["x,]", None]')).toEqual([["x,]", null]]);
  });
});

describe("scanInputValues", () => {
  it("reports an unmatched delimiter without discarding scanned text", () => {
    expect(scanInputValues("[1, 2")).toEqual({
      values: ["[1, 2"],
      error: "Unclosed delimiter '['.",
    });
  });
});
