import { expect, test } from "vitest";

import { buildPanes, selectPrimaryPane } from "./build.js";
import type { Pane, StructureKind } from "./types.js";

function pane(id: string, kind: StructureKind): Pane {
  return {
    id,
    title: id,
    model: {
      kind,
      directed: false,
      nodes: [],
      edges: [],
      ranks: [],
      notes: [],
    },
  };
}

test("selects the first visualizable pane by default", () => {
  const panes = [pane("tree", "binary-tree"), pane("grid", "matrix")];

  expect(selectPrimaryPane(panes)?.id).toBe("tree");
});

test("prefers a pane matching the structure override", () => {
  const panes = [pane("tree", "binary-tree"), pane("grid", "matrix")];

  expect(selectPrimaryPane(panes, "matrix")?.id).toBe("grid");
});

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

test("draws a pretty-printed binary tree as one structure", () => {
  const result = buildPanes("[\n  4,\n  2,\n  7,\n  1,\n  3,\n  6,\n  9\n]", {
    method: "invertTree",
    params: [{ type: "TreeNode*", name: "root" }],
  });

  expect(result.failures).toEqual([]);
  expect(result.panes).toHaveLength(1);
  expect(result.panes[0]?.model.kind).toBe("binary-tree");
});

test("draws a binary tree that has no null slots", () => {
  const result = buildPanes("[1,2,3]", {
    method: "invertTree",
    params: [{ type: "TreeNode*", name: "root" }],
  });

  expect(result.failures).toEqual([]);
  expect(result.panes[0]?.model.kind).toBe("binary-tree");
  expect(result.panes[0]?.model.nodes.filter((n) => n.role === "root" || n.role === "normal")).toHaveLength(3);
});

test("keeps an empty tree as a pane instead of a parse failure", () => {
  const result = buildPanes("[]", {
    method: "invertTree",
    params: [{ type: "TreeNode*", name: "root" }],
  });

  expect(result.panes).toHaveLength(1);
  expect(result.panes[0]?.model.notes).toContain("Empty tree.");
});

test("draws course-schedule edges next to n", () => {
  const result = buildPanes("2\n[[1,0]]", {
    method: "canFinish",
    params: [
      { type: "int", name: "numCourses" },
      { type: "vector<vector<int>>&", name: "prerequisites" },
    ],
  });

  expect(result.failures).toEqual([]);
  expect(result.panes[0]?.model.kind).toBe("graph");
  expect(result.panes[0]?.model.directed).toBe(true);
});

test("draws a string grid as a matrix", () => {
  const result = buildPanes('["11110","11010","11000","00000"]', {
    method: "numIslands",
    params: [{ type: "vector<vector<char>>&", name: "grid" }],
  });

  expect(result.failures).toEqual([]);
  expect(result.panes[0]?.model.kind).toBe("matrix");
});
