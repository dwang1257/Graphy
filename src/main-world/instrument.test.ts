import { execFileSync } from "node:child_process";
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
  it("compiles a typical reverse-list Solution.py after instrumentation", () => {
    const starter = `# Definition for singly-linked list.
# class ListNode:
#     def __init__(self, val=0, next=None):
#         self.val = val
#         self.next = next
class Solution:
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
    expect(PYTHON_TRACER).toContain("def is_list");
    expect(PYTHON_TRACER).toContain("def is_grid");
    expect(PYTHON_TRACER).toContain('return "(%s,%s)" % item');
    expect(PYTHON_TRACER).not.toMatch(/\bnonlocal\b/);
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
