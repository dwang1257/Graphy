import { describe, expect, it } from "vitest";

import { parseBinaryTree } from "./binaryTree.js";
import { parseLinkedLists } from "./linkedList.js";
import { parseMatrix } from "./matrix.js";

describe("parseMatrix", () => {
  it("expands equal-length strings into character cells", () => {
    const model = parseMatrix(["11110", "10001"]);

    expect(model.matrix?.rows.map((row) => row.map((cell) => cell.text))).toEqual([
      ["1", "1", "1", "1", "0"],
      ["1", "0", "0", "0", "1"],
    ]);
    expect(model.matrix?.rows.map((row) => row.map((cell) => cell.filled))).toEqual([
      [true, true, true, true, false],
      [true, false, false, false, true],
    ]);
  });
});

describe("parseBinaryTree", () => {
  it("prefixes level-order slot ids with the pane letter and skips null slots", () => {
    const model = parseBinaryTree([1, null, 2], "root", "a");

    expect(model).toMatchObject({ kind: "binary-tree", title: "root", directed: true, edges: [], ranks: [] });
    expect(model.nodes).toEqual([
      { id: "a0", label: "1", role: "root" },
      { id: "a2", label: "2", role: "normal" },
    ]);
    expect(model.links).toEqual({ a0: { right: "a2" }, a2: {} });
  });

  it("keeps slot numbering across deeper null gaps", () => {
    const model = parseBinaryTree([1, null, 2, 3], "root", "b");

    expect(model.nodes.map((node) => node.id)).toEqual(["b0", "b2", "b3"]);
    expect(model.links).toEqual({ b0: { right: "b2" }, b2: { left: "b3" }, b3: {} });
  });

  it("links both children of every parsed node", () => {
    const model = parseBinaryTree([4, 2, 7, 1, 3], "root", "a");

    expect(model.links).toEqual({
      a0: { left: "a1", right: "a2" },
      a1: { left: "a3", right: "a4" },
      a2: {},
      a3: {},
      a4: {},
    });
    expect(model.nodes.filter((node) => node.role === "root").map((node) => node.id)).toEqual(["a0"]);
  });

  it("returns an empty model for empty, null-rooted, and scalar values", () => {
    expect(parseBinaryTree([], "root", "a").nodes).toEqual([]);
    expect(parseBinaryTree([null], "root", "a").nodes).toEqual([]);
    expect(parseBinaryTree(5, "p", "b")).toMatchObject({ nodes: [], links: {}, edges: [], ranks: [] });
  });

  it("rejects values that no parent can reach", () => {
    expect(() => parseBinaryTree([1, null, null, 2], "root", "a")).toThrow("unreachable");
    expect(() => parseBinaryTree([null, 1], "root", "a")).toThrow("unreachable");
  });
});

describe("parseLinkedLists", () => {
  it("links a single list with next pointers and a root head", () => {
    const model = parseLinkedLists([[1, 2, 3]], { title: "head" }, "a");

    expect(model).toMatchObject({ kind: "linked-list", title: "head", edges: [], ranks: [] });
    expect(model.nodes).toEqual([
      { id: "a0", label: "1", role: "root" },
      { id: "a1", label: "2", role: "normal" },
      { id: "a2", label: "3", role: "normal" },
    ]);
    expect(model.links).toEqual({ a0: { next: "a1" }, a1: { next: "a2" }, a2: {} });
    expect(model.listGroups).toEqual([["a0", "a1", "a2"]]);
  });

  it("links the tail back to the requested cycle position", () => {
    const model = parseLinkedLists([[1, 2, 3, 4]], { cyclePos: 1 }, "a");

    expect(model.links).toEqual({
      a0: { next: "a1" },
      a1: { next: "a2" },
      a2: { next: "a3" },
      a3: { next: "a1" },
    });
  });

  it("ignores negative and out-of-range cycle positions", () => {
    expect(parseLinkedLists([[1, 2]], { cyclePos: -1 }, "a").links).toEqual({ a0: { next: "a1" }, a1: {} });
    expect(parseLinkedLists([[1, 2]], { cyclePos: 5 }, "a").links).toEqual({ a0: { next: "a1" }, a1: {} });
  });

  it("runs ids across non-empty sublists and marks every sublist head as a root", () => {
    const model = parseLinkedLists([[1, 4], [], [2, 3, 5], [7]], {}, "c");

    expect(model.listGroups).toEqual([
      ["c0", "c1"],
      ["c2", "c3", "c4"],
      ["c5"],
    ]);
    expect(model.nodes.filter((node) => node.role === "root").map((node) => node.id)).toEqual(["c0", "c2", "c5"]);
    expect(model.links).toMatchObject({ c1: {}, c2: { next: "c3" }, c4: {}, c5: {} });
  });

  it("returns an empty model with empty links and groups for an empty list", () => {
    expect(parseLinkedLists([[]], {}, "a")).toMatchObject({ nodes: [], links: {}, listGroups: [] });
  });
});
