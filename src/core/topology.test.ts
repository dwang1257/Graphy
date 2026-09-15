import { describe, expect, it } from "vitest";

import { parseBinaryTree } from "./parse/binaryTree.js";
import { parseLinkedList, parseLinkedLists, withListAllocs } from "./parse/linkedList.js";
import { applyTopology } from "./treeModel.js";
import type { GraphModel } from "./types.js";

function liveNodes(model: GraphModel): GraphModel["nodes"] {
  return model.nodes.filter((n) => n.role === "root" || n.role === "normal");
}

describe("applyTopology", () => {
  it("swaps children on a full invert of [4,2,7,1,3,6,9]", () => {
    const base = parseBinaryTree([4, 2, 7, 1, 3, 6, 9], "root");
    const inverted = {
      n0: { left: "n2", right: "n1" },
      n1: { left: "n4", right: "n3" },
      n2: { left: "n6", right: "n5" },
      n3: {},
      n4: {},
      n5: {},
      n6: {},
    };
    const model = applyTopology(base, inverted);
    expect(model.edges.filter((e) => e.role === "normal")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "n0", to: "n2" }),
        expect.objectContaining({ from: "n0", to: "n1" }),
        expect.objectContaining({ from: "n1", to: "n4" }),
        expect.objectContaining({ from: "n2", to: "n6" }),
      ]),
    );
    expect(model.links).toEqual(inverted);
    expect(liveNodes(model)).toHaveLength(7);
  });

  it("drops an unlinked child and keeps a null-side scaffold", () => {
    const base = parseBinaryTree([4, 2, 7, 1, 3], "root");
    const model = applyTopology(base, {
      n0: { left: "n1", right: "n2" },
      n1: { right: "n4" },
      n2: {},
      n4: {},
    });
    expect(liveNodes(model).map((n) => n.id).sort()).toEqual(["n0", "n1", "n2", "n4"]);
    expect(model.nodes.some((n) => n.id === "n1_L" && n.role === "null")).toBe(true);
  });

  it("rebuilds reversed list edges and keeps every node", () => {
    const base = parseLinkedList([1, 2, 3, 4, 5], "head");
    const model = applyTopology(base, {
      n0: {},
      n1: { left: "n0" },
      n2: { left: "n1" },
      n3: { left: "n2" },
      n4: { left: "n3" },
    });
    expect(liveNodes(model).map((n) => n.id)).toEqual(["n0", "n1", "n2", "n3", "n4"]);
    expect(model.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "n4", to: "n3", role: "normal" }),
        expect.objectContaining({ from: "n1", to: "n0", role: "normal" }),
        expect.objectContaining({ from: "n0", to: "tail", role: "normal" }),
      ]),
    );
  });

  it("places allocated nodes on a third rank below two input lists", () => {
    const base = parseLinkedLists([
      { value: [2, 4], title: "l1" },
      { value: [5, 6], title: "l2" },
    ]);
    const grown = withListAllocs(base, [
      { id: "n4", label: "0", role: "normal" },
      { id: "n5", label: "7", role: "normal" },
    ]);
    const model = applyTopology(grown, {
      n0: { left: "n1" },
      n1: {},
      n2: { left: "n3" },
      n3: {},
      n4: { left: "n5" },
      n5: {},
    });
    expect(model.listGroups).toEqual([
      ["n0", "n1"],
      ["n2", "n3"],
      ["n4", "n5"],
    ]);
    expect(model.ranks).toHaveLength(3);
    expect(model.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "n4", to: "n5", role: "normal" }),
        expect.objectContaining({ from: "n2", to: "n4", role: "spine" }),
      ]),
    );
  });
});
