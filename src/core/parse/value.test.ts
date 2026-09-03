import { describe, expect, it } from "vitest";

import { parseInput, splitInputValues } from "./value.js";

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
});
