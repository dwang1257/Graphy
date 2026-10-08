import { describe, expect, it } from "vitest";

import { detectRole, structureKindOf } from "./detect.js";

describe("detectRole", () => {
  it("treats equal-width nested rows as a matrix from shape", () => {
    expect(detectRole(undefined, [[2, 4], [1, 3], [2, 4], [1, 3]])).toEqual({
      kind: "matrix",
    });
    expect(detectRole(undefined, [[0, 1], [1, 2], [2, 0]])).toEqual({
      kind: "matrix",
    });
  });

  it("maps the isConnected parameter name to a graph", () => {
    expect(
      detectRole(
        { name: "isConnected", type: "number[][]" },
        [[1, 1, 0], [1, 1, 0], [0, 0, 1]],
      ),
    ).toEqual({ kind: "graph" });
  });

  it("detects graphs from edge and adjacency parameter names, Node types and uneven adjacency lists", () => {
    expect(detectRole({ name: "prerequisites", type: "List[List[int]]" }, [[1, 0]])).toEqual({ kind: "graph" });
    expect(detectRole({ name: "rooms", type: "List[List[int]]" }, [[1, 3], [3, 0, 1], [2], [0]])).toEqual({ kind: "graph" });
    expect(detectRole({ name: "node", type: "Optional['Node']" }, [[2, 4], [1, 3], [2, 4], [1, 3]])).toEqual({ kind: "graph" });
    expect(detectRole(undefined, [[1, 2], [3], [3], []])).toEqual({ kind: "graph" });
  });

  it("keeps grids that only share a graph parameter name", () => {
    expect(detectRole({ name: "rooms", type: "List[List[int]]" }, [[2147483647, -1, 0], [0, -1, 2147483647]])).toEqual({ kind: "matrix" });
    expect(detectRole({ name: "edges", type: "List[List[int]]" }, [[1, 2, 3, 4]])).toEqual({ kind: "matrix" });
    expect(detectRole(undefined, [[2], [3, 4], [6, 5, 7]])).toEqual({ kind: "ignore" });
  });

  it("detects a sparse binary tree with nulls from shape", () => {
    expect(detectRole(undefined, [4, 2, null, 3, 1])).toEqual({
      kind: "binary-tree",
    });
  });

  it("ignores typed plain value arrays so Two Sum nums stay non-visual", () => {
    expect(
      detectRole({ name: "nums", type: "vector<int>" }, [2, 7, 11, 15]),
    ).toEqual({ kind: "ignore" });
    expect(
      detectRole({ name: "nums", type: "number[]" }, [2, 7, 11, 15]),
    ).toEqual({ kind: "ignore" });
  });

  it("treats LeetCode metadata scalar types as non-visual regardless of shape", () => {
    expect(detectRole({ name: "val", type: "integer" }, [1, null, 2])).toEqual({ kind: "ignore" });
    expect(detectRole({ name: "ch", type: "character" }, ["ab", "cd"])).toEqual({ kind: "ignore" });
  });

  it("does not let a structure parameter name override a scalar type", () => {
    expect(detectRole({ name: "target", type: "integer" }, 9)).toEqual({ kind: "ignore" });
    expect(detectRole({ name: "target", type: "TreeNode" }, [3, 5, 1])).toEqual({ kind: "binary-tree" });
    expect(detectRole({ name: "n", type: "integer" }, 4)).toEqual({ kind: "ignore" });
    expect(detectRole({ name: "pos", type: "integer" }, 1)).toEqual({ kind: "cycle-pos" });
  });

  it("keeps LeetCode metadata structure types visual", () => {
    expect(detectRole({ name: "root", type: "TreeNode" }, [1, null, 2])).toEqual({ kind: "binary-tree" });
    expect(detectRole({ name: "grid", type: "character[][]" }, [["1", "0"], ["0", "1"]])).toEqual({ kind: "matrix" });
  });

  it("ignores scalar values for node-typed and node-named parameters", () => {
    expect(detectRole({ name: "p", type: "TreeNode" }, 5)).toEqual({ kind: "ignore" });
    expect(detectRole({ name: "q", type: "TreeNode" }, null)).toEqual({ kind: "ignore" });
    expect(detectRole({ name: "head", type: "ListNode" }, 3)).toEqual({ kind: "ignore" });
    expect(detectRole({ name: "p", type: "" }, 5)).toEqual({ kind: "ignore" });
    expect(detectRole({ name: "p", type: "" }, [1, 2])).toEqual({ kind: "binary-tree" });
  });

  it("maps roles to structure kinds only for structure roles", () => {
    expect(structureKindOf({ kind: "matrix" })).toBe("matrix");
    expect(structureKindOf({ kind: "cycle-pos" })).toBeUndefined();
    expect(structureKindOf({ kind: "ignore" })).toBeUndefined();
  });
});
