import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { framesFromStdout, parseTrace } from "../core/trace.js";
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

const deleteSolution = `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class Solution:
    def trimLeft(self, root):
        if not root:
            return root
        root.left = None
        return root
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

const deleteDriver = `
n1 = TreeNode(1)
n3 = TreeNode(3)
n2 = TreeNode(2, n1, n3)
n7 = TreeNode(7)
n4 = TreeNode(4, n2, n7)
Solution().trimLeft(n4)
`;

const treeModel = {
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
  links: {
    n0: { left: "n1", right: "n2" },
    n1: { left: "n3", right: "n4" },
    n2: { left: "n5", right: "n6" },
    n3: {},
    n4: {},
    n5: {},
    n6: {},
  },
};

describe("python tracer (judge-side)", () => {
  it("emits Graphy ids in invert-tree visit order", () => {
    const script = instrumentPython(solution) + driver;
    const stdout = execFileSync("python3", ["-c", script], { encoding: "utf8" });

    const currents = framesFromStdout(stdout, treeModel)
      .filter((frame) => frame.label.startsWith("current "))
      .map((frame) => frame.current);

    expect(currents[0]).toBe("n0");
    expect(currents).toContain("n2");
    expect(currents).toContain("n1");
    expect(new Set(currents)).toEqual(new Set(["n0", "n1", "n2", "n3", "n4", "n5", "n6"]));
  });

  it("emits a topology line after the root swap", () => {
    const stdout = execFileSync("python3", ["-c", instrumentPython(solution) + driver], {
      encoding: "utf8",
    });
    const topologies = parseTrace(stdout).filter((e) => e.kind === "topology");
    expect(topologies.length).toBeGreaterThan(0);
    expect(topologies.some((e) => e.kind === "topology" && e.links.n0?.left === "n2" && e.links.n0?.right === "n1")).toBe(
      true,
    );
  });

  it("keeps tracing through Solution helper methods", () => {
    const stdout = execFileSync("python3", ["-c", instrumentPython(methodSolution) + driver], {
      encoding: "utf8",
    });
    expect(stdout).toMatch(/^#graphy\/\[/m);
    expect(parseTrace(stdout).some((e) => e.kind === "current" && e.ref === "n0")).toBe(true);
    expect(parseTrace(stdout).some((e) => e.kind === "current" && e.ref === "n2")).toBe(true);
    expect(parseTrace(stdout).some((e) => e.kind === "current" && e.ref === "n1")).toBe(true);
  });

  it("prints one packed #graphy/[array] line per run", () => {
    const stdout = execFileSync("python3", ["-c", instrumentPython(solution) + driver], {
      encoding: "utf8",
    });
    const graphyLines = stdout.split(/\r?\n/).filter((line) => /#graphy/.test(line));
    expect(graphyLines).toHaveLength(1);
    expect(graphyLines[0]).toMatch(/^#graphy\/\[/);
    expect(graphyLines[0]).toMatch(/\(0,/);
    expect(graphyLines[0]).not.toMatch(/current |visit |topology |walk /);
  });

  it("emits a case-break per top-level Solution call", () => {
    const stdout = execFileSync("python3", ["-c", instrumentPython(solution) + driver + "\nSolution().invertTree(n4)\n"], {
      encoding: "utf8",
    });
    const graphyLines = stdout.split(/\r?\n/).filter((line) => /^#graphy\//.test(line));
    expect(graphyLines.length).toBe(2);
    expect(graphyLines.every((line) => line.startsWith("#graphy/["))).toBe(true);
  });

  it("emits topology that drops an unlinked child", () => {
    const stdout = execFileSync("python3", ["-c", instrumentPython(deleteSolution) + deleteDriver], {
      encoding: "utf8",
    });
    const topologies = parseTrace(stdout).filter((e) => e.kind === "topology");
    expect(topologies.length).toBeGreaterThan(0);
    const last = topologies[topologies.length - 1];
    expect(last?.kind).toBe("topology");
    if (last?.kind === "topology") {
      expect(last.links.n0?.left).toBeUndefined();
      expect(last.links.n0?.right).toBe("n2");
      expect(last.links.n1).toBeUndefined();
      expect(last.links.n3).toBeUndefined();
      expect(last.links.n4).toBeUndefined();
    }
  });
});
