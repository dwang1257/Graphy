import { describe, expect, it } from "vitest";

import { MAX_SNAPSHOT_CASES } from "../shared/protocol.js";
import {
  parseEditCache,
  parseExampleCases,
  parseMetaData,
  parseQuestion,
  questionFromGraphql,
  questionFromNextData,
  splitDataInput,
} from "./question.js";

describe("parseMetaData", () => {
  it("returns params and their count for a regular problem", () => {
    expect(parseMetaData(JSON.stringify({
      name: "numIslands",
      params: [{ name: "grid", type: "character[][]", dealloc: false }],
    }))).toEqual({ lineCount: 1, params: [{ name: "grid", type: "character[][]" }] });
  });

  it("uses two lines per case and no params for system design problems", () => {
    expect(parseMetaData(JSON.stringify({ classname: "MinStack", systemdesign: true }))).toEqual({ lineCount: 2 });
  });

  it.each([
    ["invalid JSON", "{"],
    ["a non-string", 3],
    ["missing params", JSON.stringify({ name: "x" })],
    ["empty params", JSON.stringify({ params: [] })],
    ["a param without a type", JSON.stringify({ params: [{ name: "x" }] })],
    ["an oversized param name", JSON.stringify({ params: [{ name: "x".repeat(129), type: "integer" }] })],
    ["too many params", JSON.stringify({ params: Array.from({ length: 33 }, (_, i) => ({ name: `p${i}`, type: "integer" })) })],
  ])("rejects %s", (_label, raw) => {
    expect(parseMetaData(raw)).toBeNull();
  });
});

describe("parseExampleCases", () => {
  it("normalizes line endings and surrounding whitespace", () => {
    expect(parseExampleCases(["[1,2] \r\n 3\n", 4, "[5]"])).toEqual(["[1,2]\n3", "[5]"]);
  });

  it("caps the number of cases", () => {
    expect(parseExampleCases(Array.from({ length: MAX_SNAPSHOT_CASES + 5 }, () => "1"))).toHaveLength(MAX_SNAPSHOT_CASES);
  });

  it("returns no cases for a non-array", () => {
    expect(parseExampleCases("[1]")).toEqual([]);
  });
});

describe("parseQuestion", () => {
  it("keeps cases when metadata is unusable", () => {
    expect(parseQuestion({ exampleTestcaseList: ["[1]"], metaData: null })).toEqual({ cases: ["[1]"], lineCount: null });
  });
});

describe("question sources", () => {
  const question = { exampleTestcaseList: ["[1]"], metaData: "{}" };

  it("reads only the questionDetail query for the requested slug from __NEXT_DATA__", () => {
    const nextData = {
      props: {
        pageProps: {
          dehydratedState: {
            queries: [{ queryKey: ["questionDetail", { titleSlug: "two-sum" }], state: { data: { question } } }],
          },
        },
      },
    };
    expect(questionFromNextData(nextData, "two-sum")).toEqual(question);
    expect(questionFromNextData(nextData, "add-two-numbers")).toBeNull();
    expect(questionFromNextData({ props: null }, "two-sum")).toBeNull();
  });

  it("reads the GraphQL question and rejects a missing one", () => {
    expect(questionFromGraphql({ data: { question } })).toEqual(question);
    expect(questionFromGraphql({ data: { question: null } })).toBeNull();
    expect(questionFromGraphql({ errors: [] })).toBeNull();
  });
});

describe("parseEditCache", () => {
  it("joins each case's params and trims them", () => {
    expect(parseEditCache(JSON.stringify([[" [1] ", "2"], ["[3]", "4"]]), 2)).toEqual(["[1]\n2", "[3]\n4"]);
  });

  it("accepts any param count when metadata is unknown", () => {
    expect(parseEditCache(JSON.stringify([["[1]", "2", "3"]]), null)).toEqual(["[1]\n2\n3"]);
  });

  it.each([
    ["missing", null],
    ["a case with a multi-line param", JSON.stringify([["[1]\n2"]])],
    ["an empty case", JSON.stringify([[]])],
    ["too many cases", JSON.stringify(Array.from({ length: MAX_SNAPSHOT_CASES + 1 }, () => ["1"]))],
  ])("rejects %s", (_label, raw) => {
    expect(parseEditCache(raw, null)).toBeNull();
  });
});

describe("splitDataInput", () => {
  it("chunks lines by the parameter count", () => {
    expect(splitDataInput("[1]\n2\n[3]\n4", 2)).toEqual(["[1]\n2", "[3]\n4"]);
  });

  it("tolerates a trailing newline", () => {
    expect(splitDataInput("[1]\n2\n[3]\n4\n", 2)).toEqual(["[1]\n2", "[3]\n4"]);
  });

  it("drops trailing blank lines before chunking single-param cases", () => {
    expect(splitDataInput("1\n2\n", 1)).toEqual(["1", "2"]);
    expect(splitDataInput("1\r\n2\r\n\r\n  \r\n", 1)).toEqual(["1", "2"]);
  });

  it("keeps interior blank lines when the count divides", () => {
    expect(splitDataInput("a\n\nb\nc\n", 2)).toEqual(["a\n", "b\nc"]);
  });

  it("keeps blank params inside a case", () => {
    expect(splitDataInput("[]\n[]\n[1]\n[2]", 2)).toEqual(["[]\n[]", "[1]\n[2]"]);
  });

  it("returns null for blank input", () => {
    expect(splitDataInput("", 2)).toBeNull();
    expect(splitDataInput(" \n ", 1)).toBeNull();
  });

  it("falls back to one case when the count is unknown or does not divide", () => {
    expect(splitDataInput("[1]\n2\n3", 2)).toEqual(["[1]\n2\n3"]);
    expect(splitDataInput("[1]\n2", null)).toEqual(["[1]\n2"]);
  });
});
