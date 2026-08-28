import { describe, expect, it } from "vitest";

import { parseBinaryTree } from "./binaryTree.js";
import { parseLinkedList } from "./linkedList.js";
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
  });
});
