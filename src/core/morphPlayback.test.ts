import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { framesFromStdout, parseTrace } from "../core/trace.js";
import { canonicalizeLinks } from "../core/topology.js";
import { applyTopology } from "../core/treeModel.js";
import { parseBinaryTree } from "../core/parse/binaryTree.js";
import { parseLinkedList } from "../core/parse/linkedList.js";
import { instrumentPython } from "../main-world/instrument.js";

const TREE_NODE = `class TreeNode:
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right
`;

const invert = `${TREE_NODE}
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

const walkOnly = `${TREE_NODE}
class Solution:
    def inorder(self, root):
        out = []
        def go(node):
            if not node:
                return
            go(node.left)
            out.append(node.val)
            go(node.right)
        go(root)
        return out
`;

const deleteLeft = `${TREE_NODE}
class Solution:
    def trimLeft(self, root):
        if not root:
            return root
        root.left = None
        return root
`;

function runPython(source: string, driver: string): string {
  return execFileSync("python3", ["-c", instrumentPython(source) + driver], {
    encoding: "utf8",
  });
}

function topologyKeys(frames: ReturnType<typeof framesFromStdout>): Set<string> {
  return new Set(frames.map((f) => canonicalizeLinks(f.links)).filter(Boolean));
}

describe("tree morph playback (integration)", () => {
  it("invert emits topology frames that rebuild swapped edges", () => {
    const driver = `
n1 = TreeNode(1); n3 = TreeNode(3); n6 = TreeNode(6); n9 = TreeNode(9)
n2 = TreeNode(2, n1, n3); n7 = TreeNode(7, n6, n9); n4 = TreeNode(4, n2, n7)
Solution().invertTree(n4)
`;
    const stdout = runPython(invert, driver);
    const base = parseBinaryTree([4, 2, 7, 1, 3, 6, 9], "root");
    const frames = framesFromStdout(stdout, base);
    const topo = frames.filter((f) => f.label === "topology");
    expect(topo.length).toBeGreaterThan(0);

    const swapped = topo.find((f) => f.links.n0?.left === "n2" && f.links.n0?.right === "n1");
    expect(swapped).toBeTruthy();
    const model = applyTopology(base, swapped!.links);
    expect(model.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "n0", to: "n2", role: "normal" }),
        expect.objectContaining({ from: "n0", to: "n1", role: "normal" }),
      ]),
    );

    expect(topologyKeys(frames).size).toBeGreaterThan(1);
  });

  it("delete marks unlinked children in deleted and drops them from the model", () => {
    const driver = `
n1 = TreeNode(1); n3 = TreeNode(3)
n2 = TreeNode(2, n1, n3); n7 = TreeNode(7); n4 = TreeNode(4, n2, n7)
Solution().trimLeft(n4)
`;
    const stdout = runPython(deleteLeft, driver);
    const base = parseBinaryTree([4, 2, 7, 1, 3], "root");
    const frames = framesFromStdout(stdout, base);
    const lastTopo = [...frames].reverse().find((f) => f.label === "topology");
    expect(lastTopo).toBeTruthy();
    expect(lastTopo!.deleted.sort()).toEqual(["n1", "n3", "n4"]);
    const model = applyTopology(base, lastTopo!.links);
    expect(
      model.nodes.filter((n) => n.role === "root" || n.role === "normal").map((n) => n.id).sort(),
    ).toEqual(["n0", "n2"]);
  });

  it("non-mutating walks do not emit topology lines", () => {
    const driver = `
n1 = TreeNode(1); n3 = TreeNode(3)
n2 = TreeNode(2, n1, n3); n7 = TreeNode(7); n4 = TreeNode(4, n2, n7)
Solution().inorder(n4)
`;
    const stdout = runPython(walkOnly, driver);
    expect(stdout).toMatch(/^#graphy\/\[/m);
    expect(parseTrace(stdout).some((e) => e.kind === "topology")).toBe(false);
    expect(parseTrace(stdout).some((e) => e.kind === "current" && e.ref === "n0")).toBe(true);
  });
});

const reverseList = `class ListNode:
    def __init__(self, val=0, next=None):
        self.val = val
        self.next = next

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

describe("list morph playback (integration)", () => {
  it("reverse emits topology frames that rebuild flipped next pointers", () => {
    const driver = `
n4 = ListNode(5); n3 = ListNode(4, n4); n2 = ListNode(3, n3)
n1 = ListNode(2, n2); n0 = ListNode(1, n1)
Solution().reverseList(n0)
`;
    const stdout = runPython(reverseList, driver);
    const base = parseLinkedList([1, 2, 3, 4, 5], "head");
    const frames = framesFromStdout(stdout, base);
    const topo = frames.filter((f) => f.label === "topology");
    expect(topo.length).toBeGreaterThan(0);
    expect(topo.every((f) => f.deleted.length === 0)).toBe(true);

    const flipped = topo.find((f) => f.links.n1?.left === "n0");
    expect(flipped).toBeTruthy();
    const model = applyTopology(base, flipped!.links);
    expect(model.kind).toBe("linked-list");
    expect(model.edges).toEqual(
      expect.arrayContaining([expect.objectContaining({ from: "n1", to: "n0" })]),
    );

    expect(topologyKeys(frames).size).toBeGreaterThan(1);
  });
});
