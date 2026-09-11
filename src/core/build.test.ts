import { expect, test } from "vitest";

import { buildPanes } from "./build.js";
import type { GraphModel } from "./types.js";

function live(model: GraphModel | undefined): GraphModel["nodes"] | undefined {
  return model?.nodes.filter((n) => n.role === "root" || n.role === "normal");
}

test("uses the signature parameter name for a visualized argument", () => {
  const result = buildPanes("[1,2,3]\n1", {
    method: "detectCycle",
    params: [
      { type: "ListNode*", name: "head" },
      { type: "int", name: "pos" },
    ],
  });

  expect(result.panes[0]?.title).toBe("head");
});

test("visualizes a complete tree when binary-tree is selected", () => {
  const result = buildPanes("[4,2,6,3,1,5]\n1\n2", null, { override: "binary-tree" });

  expect(result.failures).toEqual([]);
  expect(result.panes[0]?.model.kind).toBe("binary-tree");
  expect(result.panes[0]?.model.nodes.some((n) => n.role === "root")).toBe(true);
});

test("visualizes a sparse tree when binary-tree is selected", () => {
  const result = buildPanes("[4,2,null,3,1]\n1\n3", null, { override: "binary-tree" });

  expect(result.failures).toEqual([]);
  expect(result.panes[0]?.model.kind).toBe("binary-tree");
});

test("with a structure selected, only the first array is drawn", () => {
  const result = buildPanes("[4,2,6,3,1,5]\n1\n2", {
    method: "lowestCommonAncestor",
    params: [
      { type: "TreeNode*", name: "root" },
      { type: "TreeNode*", name: "p" },
      { type: "TreeNode*", name: "q" },
    ],
  }, { override: "binary-tree" });

  expect(result.failures).toEqual([]);
  expect(result.panes).toHaveLength(1);
  expect(result.panes[0]?.model.nodes.some((n) => n.role === "root")).toBe(true);
});

test("with a structure selected, skips leading scalars and uses the first array", () => {
  const result = buildPanes("2\n[[1,0],[0,1]]", null, { override: "matrix" });

  expect(result.failures).toEqual([]);
  expect(result.panes).toHaveLength(1);
  expect(result.panes[0]?.model.kind).toBe("matrix");
});

test("draws a pretty-printed tree plus trailing args when binary-tree is selected", () => {
  const result = buildPanes("[\n  4,\n  2,\n  6,\n  3,\n  1,\n  5\n]\n1\n2", null, {
    override: "binary-tree",
  });

  expect(result.failures).toEqual([]);
  expect(result.panes).toHaveLength(1);
  expect(result.panes[0]?.model.kind).toBe("binary-tree");
  expect(result.panes[0]?.model.nodes.some((n) => n.role === "root")).toBe(true);
});

test("draws both Add Two Numbers lists in one pane when linked-list is selected", () => {
  const result = buildPanes("[2,4,3]\n[5,6,4]", {
    method: "addTwoNumbers",
    params: [
      { type: "Optional[ListNode]", name: "l1" },
      { type: "Optional[ListNode]", name: "l2" },
    ],
  }, { override: "linked-list" });

  expect(result.failures).toEqual([]);
  expect(result.panes).toHaveLength(1);
  const liveNodes = live(result.panes[0]?.model);
  expect(liveNodes?.map((n) => n.id)).toEqual(["n0", "n1", "n2", "n3", "n4", "n5"]);
  expect(liveNodes?.map((n) => n.label)).toEqual(["2", "4", "3", "5", "6", "4"]);
  expect(result.panes[0]?.model.listGroups).toEqual([
    ["n0", "n1", "n2"],
    ["n3", "n4", "n5"],
  ]);
});

test("merges two ListNode parameters even without a manual override", () => {
  const result = buildPanes("[1,2,4]\n[1,3,4]", {
    method: "mergeTwoLists",
    params: [
      { type: "ListNode*", name: "list1" },
      { type: "ListNode*", name: "list2" },
    ],
  });

  expect(result.panes).toHaveLength(1);
  expect(live(result.panes[0]?.model)).toHaveLength(6);
});

test("draws up to three lists from a vector of ListNode chains", () => {
  const result = buildPanes("[[1,4,5],[1,3,4],[2,6],[7]]", {
    method: "mergeKLists",
    params: [{ type: "vector<ListNode*>", name: "lists" }],
  }, { override: "linked-list" });

  expect(result.panes).toHaveLength(1);
  expect(result.panes[0]?.model.listGroups).toHaveLength(3);
  expect(
    live(result.panes[0]?.model)?.map((n) => n.label),
  ).toEqual(["1", "4", "5", "1", "3", "4", "2", "6"]);
});
