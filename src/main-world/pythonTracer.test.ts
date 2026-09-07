import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { framesFromStdout } from "../core/trace.js";
import { emptyModel } from "../core/types.js";
import { instrumentPython } from "./instrument.js";

const solution = `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class Solution:
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

const methodSolution = `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class Solution:
    def invertTree(self, root):
        self.walk(root)
        return root
    def walk(self, node):
        if not node:
            return
        node.left, node.right = node.right, node.left
        self.walk(node.left)
        self.walk(node.right)
`;

const driver = `
# [4,2,7,1,3,6,9] — Graphy ids n0..n6 matching level-order slots
n1 = TreeNode(1)
n3 = TreeNode(3)
n6 = TreeNode(6)
n9 = TreeNode(9)
n2 = TreeNode(2, n1, n3)
n7 = TreeNode(7, n6, n9)
n4 = TreeNode(4, n2, n7)
Solution().invertTree(n4)
`;

describe("python tracer (judge-side)", () => {
  it("emits Graphy ids in invert-tree visit order", () => {
    const script = instrumentPython(solution) + driver;
    const stdout = execFileSync("python3", ["-c", script], { encoding: "utf8" });

    const model = {
      ...emptyModel("binary-tree", "root"),
      nodes: [
        { id: "n0", label: "4", role: "root" as const },
        { id: "n1", label: "2", role: "normal" as const },
        { id: "n2", label: "7", role: "normal" as const },
        { id: "n3", label: "1", role: "normal" as const },
        { id: "n4", label: "3", role: "normal" as const },
        { id: "n5", label: "6", role: "normal" as const },
        { id: "n6", label: "9", role: "normal" as const },
      ],
    };

    const currents = framesFromStdout(stdout, model)
      .filter((frame) => frame.label.startsWith("current "))
      .map((frame) => frame.current);

    expect(currents[0]).toBe("n0");
    expect(currents).toContain("n2");
    expect(currents).toContain("n1");
    expect(new Set(currents)).toEqual(new Set(["n0", "n1", "n2", "n3", "n4", "n5", "n6"]));
  });

  it("keeps tracing through Solution helper methods", () => {
    const stdout = execFileSync("python3", ["-c", instrumentPython(methodSolution) + driver], {
      encoding: "utf8",
    });
    expect(stdout).toMatch(/#graphy walk n0\b/);
    expect(stdout).toContain("n2");
    expect(stdout).toContain("n1");
  });

  it("prints the whole walk on a single stdout line", () => {
    const stdout = execFileSync("python3", ["-c", instrumentPython(solution) + driver], {
      encoding: "utf8",
    });
    const graphyLines = stdout.split(/\r?\n/).filter((line) => /#graphy\b/.test(line));
    expect(graphyLines).toHaveLength(1);
    expect(graphyLines[0]).toMatch(/^#graphy walk n0(?: n\d+)+$/);
  });
});
