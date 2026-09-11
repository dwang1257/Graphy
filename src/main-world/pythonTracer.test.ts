import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { framesFromStdout, parseTrace } from "../core/trace.js";
import { parseLinkedList } from "../core/parse/linkedList.js";
import { applyTopology } from "../core/treeModel.js";
import { emptyModel } from "../core/types.js";
import { instrumentPython } from "./instrument.js";

const TREE_NODE = `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right`;

const LIST_NODE = `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next`;

const solution = `${TREE_NODE}

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

const methodSolution = `${TREE_NODE}

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

const deleteSolution = `${TREE_NODE}

class Solution:
    def trimLeft(self, root):
        if not root:
            return root
        root.left = None
        return root
`;

const driver = `
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

function runPy(src: string, timeout?: number): string {
  return execFileSync("python3", ["-c", src], { encoding: "utf8", timeout });
}

function traced(src: string, extra = "", timeout?: number): string {
  return runPy(instrumentPython(src) + extra, timeout);
}

function graphyLines(stdout: string): string[] {
  return stdout.split(/\r?\n/).filter((line) => /#graphy/.test(line));
}

describe("python tracer (judge-side)", () => {
  it("emits Graphy ids in invert-tree visit order", () => {
    const currents = framesFromStdout(traced(solution, driver), treeModel)
      .filter((frame) => frame.label.startsWith("current "))
      .map((frame) => frame.current);

    expect(currents[0]).toBe("n0");
    expect(currents).toContain("n2");
    expect(currents).toContain("n1");
    expect(new Set(currents)).toEqual(new Set(["n0", "n1", "n2", "n3", "n4", "n5", "n6"]));
  });

  it("emits a topology line after the root swap", () => {
    const topologies = parseTrace(traced(solution, driver)).filter((e) => e.kind === "topology");
    expect(topologies.length).toBeGreaterThan(0);
    expect(topologies.some((e) => e.kind === "topology" && e.links.n0?.left === "n2" && e.links.n0?.right === "n1")).toBe(
      true,
    );
  });

  it("keeps tracing through Solution helper methods", () => {
    const stdout = traced(methodSolution, driver);
    expect(stdout).toMatch(/^#graphy\/\[/m);
    expect(parseTrace(stdout).some((e) => e.kind === "current" && e.ref === "n0")).toBe(true);
    expect(parseTrace(stdout).some((e) => e.kind === "current" && e.ref === "n2")).toBe(true);
    expect(parseTrace(stdout).some((e) => e.kind === "current" && e.ref === "n1")).toBe(true);
  });

  it("prints one packed #graphy/[array] line per run", () => {
    const lines = graphyLines(traced(solution, driver));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^#graphy\/\[/);
    expect(lines[0]).toMatch(/\(0,/);
    expect(lines[0]).not.toMatch(/current |visit |topology |walk /);
  });

  it("emits a case-break per top-level Solution call", () => {
    const lines = graphyLines(traced(solution, driver + "\nSolution().invertTree(n4)\n"));
    expect(lines.length).toBe(2);
    expect(lines.every((line) => line.startsWith("#graphy/["))).toBe(true);
  });

  it("emits topology that drops an unlinked child", () => {
    const topologies = parseTrace(traced(deleteSolution, deleteDriver)).filter((e) => e.kind === "topology");
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

  const listSolution = `${LIST_NODE}

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

  const listDriver = `
n4 = ListNode(5)
n3 = ListNode(4, n4)
n2 = ListNode(3, n3)
n1 = ListNode(2, n2)
n0 = ListNode(1, n1)
Solution().reverseList(n0)
`;

  const listModel = parseLinkedList([1, 2, 3, 4, 5], "head");

  it("emits Graphy ids and next-pointer topology while reversing a list", () => {
    const stdout = traced(listSolution, listDriver);
    const currents = framesFromStdout(stdout, listModel)
      .filter((frame) => frame.label.startsWith("current "))
      .map((frame) => frame.current);

    expect(currents[0]).toBe("n0");
    expect(new Set(currents)).toEqual(new Set(["n0", "n1", "n2", "n3", "n4"]));

    const topologies = parseTrace(stdout).filter((e) => e.kind === "topology");
    expect(topologies.length).toBeGreaterThan(0);
    expect(
      topologies.some((e) => e.kind === "topology" && e.links.n0 && !e.links.n0.left && !e.links.n0.right),
    ).toBe(true);
    expect(topologies.some((e) => e.kind === "topology" && e.links.n1?.left === "n0")).toBe(true);

    const frames = framesFromStdout(stdout, listModel);
    const lastTopo = [...frames].reverse().find((frame) => frame.label === "topology");
    expect(lastTopo?.deleted).toEqual([]);
    expect(lastTopo?.links.n4?.left).toBe("n3");
    expect(lastTopo?.links.n0?.left).toBeUndefined();

    const reversed = applyTopology(listModel, lastTopo!.links);
    expect(reversed.kind).toBe("linked-list");
    expect(reversed.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "n4", to: "n3", role: "normal" }),
        expect.objectContaining({ from: "n3", to: "n2", role: "normal" }),
        expect.objectContaining({ from: "n1", to: "n0", role: "normal" }),
      ]),
    );

    const lines = graphyLines(stdout);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^#graphy\/\[/);
    expect(lines[0]).toMatch(/\(0,/);
    expect(lines[0]).not.toMatch(/current |visit |topology |walk /);
  });

  it("emits next-pointer topology for recursive reverse", () => {
    const recursive = `${LIST_NODE}

class Solution:
    def reverseList(self, head):
        if not head or not head.next:
            return head
        new_head = self.reverseList(head.next)
        head.next.next = head
        head.next = None
        return new_head
`;
    const stdout = traced(recursive, listDriver);
    const topologies = parseTrace(stdout).filter((e) => e.kind === "topology");
    expect(topologies.length).toBeGreaterThan(0);
    const frames = framesFromStdout(stdout, listModel);
    const lastTopo = [...frames].reverse().find((frame) => frame.label === "topology");
    expect(lastTopo?.links.n4?.left).toBe("n3");
    expect(lastTopo?.links.n0?.left).toBeUndefined();
    expect(applyTopology(listModel, lastTopo!.links).edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "n4", to: "n3" }),
        expect.objectContaining({ from: "n1", to: "n0" }),
      ]),
    );
  });

  it("does not treat TreeNodes as lists even when they have next", () => {
    const treeWithNext = `${TREE_NODE}
        self.next = None

class Solution:
    def walk(self, root):
        def traverse(node):
            if not node:
                return
            traverse(node.left)
            traverse(node.right)
        traverse(root)
        return root
`;
    const treeWithNextDriver = `
left = TreeNode(2)
right = TreeNode(3)
root = TreeNode(1, left, right)
root.next = right
Solution().walk(root)
`;
    const hybridModel = {
      ...emptyModel("binary-tree", "root"),
      nodes: [
        { id: "n0", label: "1", role: "root" as const },
        { id: "n1", label: "2", role: "normal" as const },
        { id: "n2", label: "3", role: "normal" as const },
      ],
    };
    const currents = framesFromStdout(traced(treeWithNext, treeWithNextDriver), hybridModel)
      .filter((frame) => frame.label.startsWith("current "))
      .map((frame) => frame.current);

    expect(new Set(currents)).toEqual(new Set(["n0", "n1", "n2"]));
  });

  it("tags a cyclic list without looping", () => {
    const cycleSolution = `${LIST_NODE}

class Solution:
    def walk(self, head):
        curr = head
        steps = 0
        while curr and steps < 8:
            steps += 1
            curr = curr.next
        return head
`;
    const cycleDriver = `
n0 = ListNode(1)
n1 = ListNode(2)
n2 = ListNode(3)
n0.next = n1
n1.next = n2
n2.next = n0
Solution().walk(n0)
`;
    const cycleModel = {
      ...emptyModel("linked-list", "head"),
      nodes: [
        { id: "n0", label: "1", role: "root" as const },
        { id: "n1", label: "2", role: "normal" as const },
        { id: "n2", label: "3", role: "normal" as const },
      ],
    };
    const stdout = traced(cycleSolution, cycleDriver, 5000);
    const currents = framesFromStdout(stdout, cycleModel)
      .filter((frame) => frame.label.startsWith("current "))
      .map((frame) => frame.current);
    expect(new Set(currents)).toEqual(new Set(["n0", "n1", "n2"]));
    expect(parseTrace(stdout).some((e) => e.kind === "topology")).toBe(false);
  });

  it("tags two input lists with sequential ids", () => {
    const mergeSolution = `${LIST_NODE}

class Solution:
    def mergeTwoLists(self, list1, list2):
        curr = list1
        while curr:
            curr = curr.next
        curr = list2
        while curr:
            curr = curr.next
        return list1
`;
    const mergeDriver = `
a1 = ListNode(2)
a0 = ListNode(1, a1)
b1 = ListNode(4)
b0 = ListNode(3, b1)
Solution().mergeTwoLists(a0, b0)
`;
    const events = parseTrace(traced(mergeSolution, mergeDriver)).filter((e) => e.kind === "current");
    const refs = new Set(events.map((e) => (e.kind === "current" ? e.ref : "")));
    expect(refs.has("n0")).toBe(true);
    expect(refs.has("n1")).toBe(true);
    expect(refs.has("n2")).toBe(true);
    expect(refs.has("n3")).toBe(true);
  });

  it("discovers a result list allocated during add-two-numbers", () => {
    const addSolution = `${LIST_NODE}

class Solution:
    def addTwoNumbers(self, l1, l2):
        dummy = ListNode(0)
        curr = dummy
        carry = 0
        while l1 or l2 or carry:
            x = l1.val if l1 else 0
            y = l2.val if l2 else 0
            s = x + y + carry
            carry = s // 10
            curr.next = ListNode(s % 10)
            curr = curr.next
            if l1:
                l1 = l1.next
            if l2:
                l2 = l2.next
        return dummy.next
`;
    const addDriver = `
a2 = ListNode(3)
a1 = ListNode(4, a2)
a0 = ListNode(2, a1)
b2 = ListNode(4)
b1 = ListNode(6, b2)
b0 = ListNode(5, b1)
Solution().addTwoNumbers(a0, b0)
`;
    const events = parseTrace(traced(addSolution, addDriver));
    const allocs = events.filter((e) => e.kind === "alloc");
    expect(allocs.some((e) => e.kind === "alloc" && e.ref === "n6" && e.label === "0")).toBe(true);
    expect(allocs.some((e) => e.kind === "alloc" && e.label === "7")).toBe(true);
    expect(allocs.some((e) => e.kind === "alloc" && e.label === "8")).toBe(true);
    const topologies = events.filter((e) => e.kind === "topology");
    expect(topologies.some((e) => e.kind === "topology" && e.links.n6?.left === "n7")).toBe(true);
  });

  const islandSolution = `class Solution:
    def numIslands(self, grid):
        rows, cols = len(grid), len(grid[0])
        def dfs(i, j):
            if i < 0 or j < 0 or i >= rows or j >= cols or grid[i][j] != "1":
                return
            grid[i][j] = "0"
            dfs(i + 1, j)
            dfs(i - 1, j)
            dfs(i, j + 1)
            dfs(i, j - 1)
        for i in range(rows):
            for j in range(cols):
                if grid[i][j] == "1":
                    dfs(i, j)
        return 0
`;

  const islandDriver = `
Solution().numIslands([["1","1"],["0","1"]])
`;

  const islandModel = {
    ...emptyModel("matrix", "grid"),
    directed: false as const,
    matrix: {
      showIndices: true,
      rows: [
        [
          { text: "1", filled: true },
          { text: "1", filled: true },
        ],
        [
          { text: "0", filled: false },
          { text: "1", filled: true },
        ],
      ],
    },
  };

  it("emits (r,c) cell visits for a grid walk", () => {
    const stdout = traced(islandSolution, islandDriver);
    const lines = graphyLines(stdout);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^#graphy\/\[/);
    expect(lines[0]).toMatch(/\(\d+,\d+\)/);
    expect(lines[0]).not.toMatch(/\(\d+,\d+,None\)/);
    expect(parseTrace(stdout).some((e) => e.kind === "current" && e.ref === "0,0")).toBe(true);
    expect(framesFromStdout(stdout, islandModel).some((frame) => frame.current === "cell:0,0")).toBe(true);
  });
});
