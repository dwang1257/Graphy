import { describe, expect, it } from "vitest";

import { GRAPHY_TRACE_MARK, PYTHON_TRACER, instrumentPython, instrumentRunBody } from "./instrument.js";

const invert = `class Solution:
    def invertTree(self, root):
        def traverse(node):
            if not node:
                return
            node.left, node.right = node.right, node.left
            traverse(node.left)
            traverse(node.right)
        traverse(root)
        return root
`;

describe("instrumentPython", () => {
  it("appends the tracer once", () => {
    const once = instrumentPython(invert);
    expect(once).toContain("def invertTree");
    expect(once).toContain(GRAPHY_TRACE_MARK);
    expect(once.indexOf("class Solution")).toBeLessThan(once.indexOf(GRAPHY_TRACE_MARK));
    expect(instrumentPython(once)).toBe(once);
  });

  it("emits compact #g tokens instead of verbose #graphy lines", () => {
    expect(PYTHON_TRACER).toMatch(/print\("#graphy\/\[/);
    expect(PYTHON_TRACER).not.toContain("#graphy current");
    expect(PYTHON_TRACER).not.toContain("#graphy visit");
    expect(PYTHON_TRACER).not.toContain("#graphy topology");
  });
});

describe("instrumentRunBody", () => {
  it("rewrites python3 Run payloads and leaves the original code aside", () => {
    const raw = JSON.stringify({
      data_input: "[4,2,7]",
      typed_code: invert,
      lang: "python3",
    });
    const result = instrumentRunBody(raw);
    expect(result).not.toBeNull();
    expect(result?.originalCode).toBe(invert);
    const sent = JSON.parse(result!.body) as { typed_code: string; lang: string };
    expect(sent.lang).toBe("python3");
    expect(sent.typed_code).toContain(GRAPHY_TRACE_MARK);
    expect(sent.typed_code).toContain("def invertTree");
  });

  it("leaves C++ and already-traced python untouched", () => {
    expect(
      instrumentRunBody(JSON.stringify({ typed_code: "class Solution {};", lang: "cpp" })),
    ).toBeNull();
    const traced = instrumentPython(invert);
    expect(
      instrumentRunBody(JSON.stringify({ typed_code: traced, lang: "python3" })),
    ).toBeNull();
  });

  it("ignores non-json bodies", () => {
    expect(instrumentRunBody(undefined)).toBeNull();
    expect(instrumentRunBody("{")).toBeNull();
  });
});
