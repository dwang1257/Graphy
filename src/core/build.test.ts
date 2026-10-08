import { describe, expect, it } from "vitest";

import { buildPanes, detectKinds } from "./build.js";
import type { Signature } from "./signature.js";

function sig(method: string, params: Array<[string, string]>): Signature {
  return { method, params: params.map(([name, type]) => ({ name, type })) };
}

const SAME_TREE = sig("isSameTree", [["p", "TreeNode"], ["q", "TreeNode"]]);
const MERGE_LISTS = sig("mergeTwoLists", [["list1", "ListNode"], ["list2", "ListNode"]]);
const LCA = sig("lowestCommonAncestor", [["root", "TreeNode"], ["p", "TreeNode"], ["q", "TreeNode"]]);
const BUILD_TREE = sig("buildTree", [["preorder", "integer[]"], ["inorder", "integer[]"]]);
const MERGE_K = sig("mergeKLists", [["lists", "ListNode[]"]]);
const CYCLE = sig("hasCycle", [["head", "ListNode"], ["pos", "integer"]]);

describe("buildPanes", () => {
  it("draws both Same Tree roots as panes a and b", () => {
    const result = buildPanes("[1,2,3]\n[1,2,null,3]", SAME_TREE);

    expect(result.failures).toEqual([]);
    expect(result.detected).toEqual(["binary-tree", "binary-tree"]);
    expect(result.panes.map((pane) => [pane.id, pane.title, pane.model.kind])).toEqual([
      ["a", "p", "binary-tree"],
      ["b", "q", "binary-tree"],
    ]);
    expect(result.panes[1]?.model.nodes.map((node) => node.id)).toEqual(["b0", "b1", "b3"]);
  });

  it("keeps Merge Two Lists as two separate list panes", () => {
    const result = buildPanes("[1,2,4]\n[1,3,4]", MERGE_LISTS);

    expect(result.panes.map((pane) => pane.id)).toEqual(["a", "b"]);
    expect(result.panes[0]?.model.listGroups).toEqual([["a0", "a1", "a2"]]);
    expect(result.panes[1]?.model.listGroups).toEqual([["b0", "b1", "b2"]]);
    expect(result.panes[1]?.model.links).toEqual({ b0: { next: "b1" }, b1: { next: "b2" }, b2: {} });
  });

  it("draws only the LCA root and never empty panes for scalar node params", () => {
    const result = buildPanes("[3,5,1,6,2,0,8,null,null,7,4]\n5\n1", LCA);

    expect(result.failures).toEqual([]);
    expect(result.detected).toEqual(["binary-tree", undefined, undefined]);
    expect(result.panes.map((pane) => pane.id)).toEqual(["a"]);
  });

  it("asks for a structure when Build Tree arrays are not detected", () => {
    const result = buildPanes("[3,9,20,15,7]\n[9,3,15,20,7]", BUILD_TREE);

    expect(result.panes).toEqual([]);
    expect(result.detected).toEqual([undefined, undefined]);
    expect(result.failures).toEqual([{ paramName: "input", reason: "Choose a data structure from the dropdown." }]);
  });

  it("applies the global override to array values only", () => {
    const result = buildPanes("[4,2,6]\n1\n[1,2]", null, { override: "binary-tree" });

    expect(result.failures).toEqual([]);
    expect(result.detected).toEqual([undefined, undefined, undefined]);
    expect(result.panes.map((pane) => [pane.id, pane.model.kind])).toEqual([
      ["a", "binary-tree"],
      ["c", "binary-tree"],
    ]);
  });

  it("lets per-param kinds beat the override, with none skipping the param", () => {
    const result = buildPanes("[1,2,3]\n[4,5]\n[[1,0],[0,1]]", null, {
      override: "binary-tree",
      kinds: ["none", "linked-list", undefined],
    });

    expect(result.panes.map((pane) => [pane.id, pane.model.kind])).toEqual([
      ["b", "linked-list"],
      ["c", "matrix"],
    ]);
  });

  it("lets an explicit kind skip a detected structure or draw an undetected array", () => {
    const skipped = buildPanes("[1,2,3]\n[1,3,4]", MERGE_LISTS, { kinds: [undefined, "none"] });
    expect(skipped.panes.map((pane) => pane.id)).toEqual(["a"]);
    expect(skipped.detected).toEqual(["linked-list", "linked-list"]);

    const drawn = buildPanes("[3,9,20,15,7]\n[9,3,15,20,7]", BUILD_TREE, { kinds: [undefined, "binary-tree"] });
    expect(drawn.panes.map((pane) => [pane.id, pane.title])).toEqual([["b", "inorder"]]);
  });

  it("reports an explicit kind on a scalar value instead of drawing an empty pane", () => {
    const result = buildPanes("5", null, { kinds: ["binary-tree"] });

    expect(result.panes).toEqual([]);
    expect(result.failures).toEqual([{ paramName: "arg 1", reason: "arg 1 is not a valid binary tree." }]);
  });

  it("never draws nested values as trees and keeps ListNode[] under a list override", () => {
    const grid = buildPanes("[[1,0],[0,1]]", null, { override: "binary-tree" });
    expect(grid.panes.map((pane) => pane.model.kind)).toEqual(["matrix"]);

    const explicit = buildPanes("[[1,0],[0,1]]", null, { kinds: ["binary-tree"] });
    expect(explicit.failures).toEqual([{ paramName: "arg 1", reason: "arg 1 is not a valid binary tree." }]);

    const lists = buildPanes("[[1,4],[2,3]]", MERGE_K, { override: "linked-list" });
    expect(lists.panes[0]?.model.listGroups).toEqual([["a0", "a1"], ["a2", "a3"]]);

    const flattened = buildPanes("[[1,0],[0,1]]", null, { override: "linked-list" });
    expect(flattened.panes.map((pane) => pane.model.kind)).toEqual(["matrix"]);
  });

  it("draws an explicit kind on a null value as an empty pane", () => {
    const result = buildPanes("null\n[1]", null, { kinds: ["linked-list", "linked-list"] });

    expect(result.panes.map((pane) => [pane.id, pane.model.nodes.length])).toEqual([["a", 0], ["b", 1]]);
  });

  it("draws a ListNode[] parameter as one pane with running ids", () => {
    const result = buildPanes("[[1,4,5],[1,3,4],[2,6],[7]]", MERGE_K);

    expect(result.panes).toHaveLength(1);
    expect(result.panes[0]?.model.listGroups).toEqual([
      ["a0", "a1", "a2"],
      ["a3", "a4", "a5"],
      ["a6", "a7"],
      ["a8"],
    ]);
  });

  it("applies the cycle position to the first flat list pane only", () => {
    const result = buildPanes("[3,2,0,-4]\n1", CYCLE);

    expect(result.panes.map((pane) => pane.id)).toEqual(["a"]);
    expect(result.panes[0]?.model.links?.a3).toEqual({ next: "a1" });
  });

  it("reads a trailing integer after a list as the cycle position when the signature lacks pos", () => {
    const result = buildPanes("[3,2,0,-4]\n1", sig("hasCycle", [["head", "ListNode"]]));

    expect(result.panes.map((pane) => pane.id)).toEqual(["a"]);
    expect(result.panes[0]?.model.links?.a3).toEqual({ next: "a1" });
  });

  it("aligns pane letters with value positions", () => {
    const result = buildPanes("7\n[1,null,2]\n\"x\"\n[1,null,3]", null);

    expect(result.panes.map((pane) => [pane.id, pane.title])).toEqual([
      ["b", "arg 2"],
      ["d", "arg 4"],
    ]);
    expect(result.detected).toEqual([undefined, "binary-tree", undefined, "binary-tree"]);
  });

  it("limits nodes per pane and still draws the panes within the limit", () => {
    const big = `[${Array.from({ length: 101 }, (_, i) => i).join(",")}]`;
    const result = buildPanes(`[1,2]\n${big}`, MERGE_LISTS);

    expect(result.panes.map((pane) => pane.id)).toEqual(["a"]);
    expect(result.failures).toEqual([{ paramName: "list2", reason: "Input exceeds the 100-node limit." }]);
  });

  it("surfaces scanner syntax failures instead of treating malformed input as a scalar", () => {
    const result = buildPanes("[1, 2", null, { override: "binary-tree" });

    expect(result.panes).toEqual([]);
    expect(result.failures[0]?.reason).toContain("Unclosed delimiter");
  });

  it("surfaces malformed structured values as input failures", () => {
    const result = buildPanes("[1, nope]", null, { override: "binary-tree" });

    expect(result.panes).toEqual([]);
    expect(result.failures[0]?.reason).toBe("Invalid structured value.");
  });

  it("rejects non-null unreachable binary-tree values", () => {
    const result = buildPanes("[1, null, null, 2]", null, { override: "binary-tree" });

    expect(result.panes).toEqual([]);
    expect(result.failures[0]).toEqual({ paramName: "arg 1", reason: "Binary-tree input contains an unreachable value." });
  });

  it("accepts trailing null slots in a binary tree", () => {
    const result = buildPanes("[1, 2, null, null, null]", null, { override: "binary-tree" });

    expect(result.failures).toEqual([]);
    expect(result.panes[0]?.model.nodes.map((node) => node.id)).toEqual(["a0", "a1"]);
  });

  it("renders a pane for a valid empty structure", () => {
    const result = buildPanes("[]", null, { override: "binary-tree" });

    expect(result.failures).toEqual([]);
    expect(result.panes).toHaveLength(1);
    expect(result.panes[0]?.model.nodes).toEqual([]);
  });

  it("returns a clean empty result for zero testcases", () => {
    expect(buildPanes("", null)).toEqual({ panes: [], failures: [], detected: [] });
  });

  it("uses matrix indices unless disabled", () => {
    expect(buildPanes("[[1,0],[0,1]]", null).panes[0]?.model.matrix?.showIndices).toBe(true);
    expect(buildPanes("[[1,0],[0,1]]", null, { showIndices: false }).panes[0]?.model.matrix?.showIndices).toBe(false);
  });
});

describe("detectKinds", () => {
  it("detects each raw value leniently against the signature", () => {
    expect(detectKinds(["[3,5,1]", "5", "1"], LCA)).toEqual(["binary-tree", undefined, undefined]);
    expect(detectKinds(["[1,null,2]", "[[1,0],[0,1]]", "[1,2]"], null)).toEqual(["binary-tree", "matrix", undefined]);
  });

  it("detects nothing for blank or unfinished values, matching the null that gets built", () => {
    expect(detectKinds(["", "[1,2"], MERGE_LISTS)).toEqual([undefined, undefined]);
    expect(detectKinds([""], null)).toEqual([undefined]);
  });
});

describe("graph panes", () => {
  it("draws Course Schedule as a graph over every course", () => {
    const result = buildPanes("4\n[[1,0],[2,0]]", sig("canFinish", [["numCourses", "int"], ["prerequisites", "List[List[int]]"]]));

    expect(result.failures).toEqual([]);
    expect(result.panes.map((pane) => [pane.id, pane.model.kind, pane.model.nodes.length, pane.model.edges.length])).toEqual([["b", "graph", 4, 2]]);
  });

  it("keeps a grid that shares a graph parameter name", () => {
    const result = buildPanes("[[2147483647,-1,0],[0,-1,2147483647]]", sig("wallsAndGates", [["rooms", "List[List[int]]"]]));

    expect(result.panes.map((pane) => pane.model.kind)).toEqual(["matrix"]);
  });

  it("lets a nested array be drawn as a graph by choice", () => {
    const result = buildPanes("[[0,1],[1,2]]", null, { kinds: ["graph"] });

    expect(result.panes[0]?.model.edges.map((edge) => `${edge.from}-${edge.to}`)).toEqual(["a0-a1", "a1-a2"]);
  });
});
