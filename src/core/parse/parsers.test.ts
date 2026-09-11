import { describe, expect, it } from "vitest";

import { parseBinaryTree } from "./binaryTree.js";
import { parseLinkedList, parseLinkedLists } from "./linkedList.js";
import { parseMatrix } from "./matrix.js";

describe("parseMatrix", () => {
  it("expands equal-length strings into character cells", () => {
    const model = parseMatrix(["11110", "10001"]);

    expect(model.matrix?.rows).toHaveLength(2);
    expect(model.matrix?.rows[0]).toHaveLength(5);
    expect(model.matrix?.rows[1]).toHaveLength(5);
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
  it("preserves level-order children across null slots", () => {
    const model = parseBinaryTree([1, null, 2, 3]);
    const visibleNodes = model.nodes.filter((node) => node.role === "root" || node.role === "normal");
    const visibleEdges = model.edges.filter((edge) => edge.role === "normal");

    expect(visibleNodes.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "n0", label: "1" },
      { id: "n2", label: "2" },
      { id: "n3", label: "3" },
    ]);
    expect(visibleEdges).toHaveLength(2);
    expect(visibleEdges.map(({ from, to }) => ({ from, to }))).toEqual(
      expect.arrayContaining([
        { from: "n0", to: "n2" },
        { from: "n2", to: "n3" },
      ]),
    );
  });
});

describe("parseLinkedList", () => {
  it("links the tail back to the requested cycle position", () => {
    const model = parseLinkedList([1, 2, 3, 4], undefined, { cyclePos: 1 });

    expect(model.nodes.map(({ id, label }) => ({ id, label }))).toEqual([
      { id: "n0", label: "1" },
      { id: "n1", label: "2" },
      { id: "n2", label: "3" },
      { id: "n3", label: "4" },
    ]);
    expect(model.edges.at(-1)).toMatchObject({
      from: "n3",
      to: "n1",
      role: "cycle",
    });
    expect(model.links).toEqual({
      n0: { left: "n1" },
      n1: { left: "n2" },
      n2: { left: "n3" },
      n3: { left: "n1" },
    });
  });

  it("seeds next-pointer links for a linear list", () => {
    const model = parseLinkedList([1, 2, 3]);
    expect(model.links).toEqual({
      n0: { left: "n1" },
      n1: { left: "n2" },
      n2: {},
    });
  });
});

describe("parseLinkedLists", () => {
  it("assigns sequential ids across two lists and keeps each list on its own rank", () => {
    const model = parseLinkedLists([
      { value: [2, 4, 3], title: "l1" },
      { value: [5, 6, 4], title: "l2" },
    ]);

    expect(model.kind).toBe("linked-list");
    expect(model.nodes.filter((n) => n.role === "root" || n.role === "normal")).toEqual([
      { id: "n0", label: "2", role: "root" },
      { id: "n1", label: "4", role: "normal" },
      { id: "n2", label: "3", role: "normal" },
      { id: "n3", label: "5", role: "root" },
      { id: "n4", label: "6", role: "normal" },
      { id: "n5", label: "4", role: "normal" },
    ]);
    expect(model.listGroups).toEqual([
      ["n0", "n1", "n2"],
      ["n3", "n4", "n5"],
    ]);
    expect(model.ranks[0]?.ids).toEqual(expect.arrayContaining(["n0", "n1", "n2"]));
    expect(model.ranks[1]?.ids).toEqual(expect.arrayContaining(["n3", "n4", "n5"]));
    expect(model.ranks[0]?.ids).not.toEqual(expect.arrayContaining(["n3"]));
    expect(model.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "n0", to: "n1", role: "normal" }),
        expect.objectContaining({ from: "n3", to: "n4", role: "normal" }),
        expect.objectContaining({ from: "n0", to: "n3", role: "spine" }),
      ]),
    );
    expect(model.nodes.filter((n) => n.role === "terminal").map((n) => n.id)).toEqual([
      "tail0",
      "tail1",
    ]);
  });

  it("caps visualization at three lists", () => {
    const model = parseLinkedLists([
      { value: [1], title: "a" },
      { value: [2], title: "b" },
      { value: [3], title: "c" },
      { value: [4], title: "d" },
    ]);

    expect(model.nodes.filter((n) => n.role === "root" || n.role === "normal").map((n) => n.label)).toEqual([
      "1",
      "2",
      "3",
    ]);
    expect(model.listGroups).toHaveLength(3);
  });

  it("falls back to a single list when only one chain is present", () => {
    const model = parseLinkedLists([{ value: [1, 2], title: "head" }]);
    expect(model.nodes.map((n) => n.id)).toEqual(["n0", "n1", "tail"]);
    expect(model.listGroups ?? [["n0", "n1"]]).toEqual([["n0", "n1"]]);
  });
});
