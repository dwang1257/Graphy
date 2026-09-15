import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { GRAPHY_TRACE_MARK, instrumentPython, instrumentRunBody } from "./instrument.js";

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
  it("compiles a typical reverse-list Solution.py after instrumentation", () => {
    const starter = `class Solution:
    def reverseList(self, head):
        prev = None
        curr = head
        while curr:
            nxt = curr.next
            curr.next = prev
            prev = curr
            curr = nxt
        return prev
`;
    expect(() => {
      execFileSync("python3", ["-c", "compile(__import__('sys').stdin.read(), 'Solution.py', 'exec')"], {
        input: instrumentPython(starter),
        encoding: "utf8",
      });
    }).not.toThrow();
  });

  it("appends the tracer once", () => {
    const once = instrumentPython(invert);
    expect(once).toContain(GRAPHY_TRACE_MARK);
    expect(instrumentPython(once)).toBe(once);
  });
});

describe("instrumentRunBody", () => {
  it("rewrites python3 Run payloads and leaves C++ untouched", () => {
    const raw = JSON.stringify({
      data_input: "[4,2,7]",
      typed_code: invert,
      lang: "python3",
    });
    const result = instrumentRunBody(raw);
    expect(result?.originalCode).toBe(invert);
    const sent = JSON.parse(result!.body) as { typed_code: string };
    expect(sent.typed_code).toContain(GRAPHY_TRACE_MARK);

    expect(
      instrumentRunBody(JSON.stringify({ typed_code: "class Solution {};", lang: "cpp" })),
    ).toBeNull();
  });
});
