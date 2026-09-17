import { expect, test } from "vitest";

import { buildPanes } from "./build.js";
import type { GraphModel } from "./types.js";

function live(model: GraphModel | undefined): GraphModel["nodes"] | undefined {
  return model?.nodes.filter((n) => n.role === "root" || n.role === "normal");
}

test("visualizes a tree when binary-tree is selected", () => {
  const result = buildPanes("[4,2,6,3,1,5]\n1\n2", null, { override: "binary-tree" });

  expect(result.failures).toEqual([]);
  expect(result.panes[0]?.model.kind).toBe("binary-tree");
  expect(result.panes[0]?.model.nodes.some((n) => n.role === "root")).toBe(true);
});

test("skips leading scalars and uses the first array as a matrix", () => {
  const result = buildPanes("2\n[[1,0],[0,1]]", null, { override: "matrix" });

  expect(result.failures).toEqual([]);
  expect(result.panes).toHaveLength(1);
  expect(result.panes[0]?.model.kind).toBe("matrix");
});

test("draws both Add Two Numbers lists in one pane", () => {
  const result = buildPanes("[2,4,3]\n[5,6,4]", {
    method: "addTwoNumbers",
    params: [
      { type: "Optional[ListNode]", name: "l1" },
      { type: "Optional[ListNode]", name: "l2" },
    ],
  }, { override: "linked-list" });

  expect(result.panes).toHaveLength(1);
  expect(live(result.panes[0]?.model)?.map((n) => n.label)).toEqual(["2", "4", "3", "5", "6", "4"]);
  expect(result.panes[0]?.model.listGroups).toEqual([
    ["n0", "n1", "n2"],
    ["n3", "n4", "n5"],
  ]);
});

test("draws up to three lists from a vector of ListNode chains", () => {
  const result = buildPanes("[[1,4,5],[1,3,4],[2,6],[7]]", {
    method: "mergeKLists",
    params: [{ type: "vector<ListNode*>", name: "lists" }],
  }, { override: "linked-list" });

  expect(result.panes[0]?.model.listGroups).toHaveLength(3);
  expect(live(result.panes[0]?.model)?.map((n) => n.label)).toEqual([
    "1", "4", "5", "1", "3", "4", "2", "6",
  ]);
});

test("surfaces scanner syntax failures instead of treating malformed input as a scalar", () => {
  const result = buildPanes("[1, 2", null, { override: "binary-tree" });

  expect(result.panes).toEqual([]);
  expect(result.failures[0]?.reason).toContain("Unclosed delimiter");
});

test("surfaces malformed structured values as input failures", () => {
  const result = buildPanes("[1, nope]", null, { override: "binary-tree" });

  expect(result.panes).toEqual([]);
  expect(result.failures[0]?.reason).toBe("Invalid structured value.");
});

test("rejects non-null unreachable binary-tree values", () => {
  const result = buildPanes("[1, null, null, 2]", null, { override: "binary-tree" });

  expect(result.panes).toEqual([]);
  expect(result.failures[0]?.reason).toContain("unreachable");
});

test("rejects values after a null binary-tree root", () => {
  const result = buildPanes("[null, 1]", null, { override: "binary-tree" });

  expect(result.panes).toEqual([]);
  expect(result.failures[0]?.reason).toContain("unreachable");
});

test("accepts trailing null slots in a binary tree", () => {
  const result = buildPanes("[1, 2, null, null, null]", null, { override: "binary-tree" });

  expect(result.failures).toEqual([]);
  expect(result.panes[0]?.model.nodes.filter((node) => node.role === "normal")).toHaveLength(1);
});

test("renders a pane for a valid empty structure", () => {
  const result = buildPanes("[]", null, { override: "binary-tree" });

  expect(result.failures).toEqual([]);
  expect(result.panes).toHaveLength(1);
  expect(result.panes[0]?.model.nodes).toEqual([]);
});

test("returns a clean empty result for zero testcases", () => {
  expect(buildPanes("", null)).toEqual({ panes: [], failures: [] });
});

test("reports when no parameter is visualizable", () => {
  const result = buildPanes("7", null);

  expect(result.panes).toEqual([]);
  expect(result.failures[0]?.reason).toContain("No visualizable parameter");
});

test("rejects a structure beyond the node limit before building its model", () => {
  const result = buildPanes(`[${Array.from({ length: 101 }, (_, i) => i).join(",")}]`, null, {
    override: "linked-list",
  });

  expect(result.panes).toEqual([]);
  expect(result.failures[0]?.reason).toContain("node limit");
});
