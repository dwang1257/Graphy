import { describe, expect, it } from "vitest";

import { parseBinaryTree } from "./parse/binaryTree.js";
import { parseLinkedList, parseLinkedLists, withListAllocs } from "./parse/linkedList.js";
import { deletedIds, parseTopologyTokens, reachableIds, supportsTopologyMorph } from "./topology.js";
import { applyTopology } from "./treeModel.js";
import type { GraphModel } from "./types.js";

function liveNodes(model: GraphModel): GraphModel["nodes"] {
  return model.nodes.filter((n) => n.role === "root" || n.role === "normal");
}

describe("supportsTopologyMorph", () => {
  it("includes trees and lists so reverse-list can animate", () => {
    expect(supportsTopologyMorph("binary-tree")).toBe(true);
    expect(supportsTopologyMorph("linked-list")).toBe(true);
    expect(supportsTopologyMorph("matrix")).toBe(false);
  });
});

describe("parseTopologyTokens", () => {
  it("parses parent:left,right tokens with - for None", () => {
    expect(parseTopologyTokens("n0:n2,n1 n1:-,- n2:n6,n5")).toEqual({
      n0: { left: "n2", right: "n1" },
      n1: {},
      n2: { left: "n6", right: "n5" },
    });
  });

  it("returns empty links for an empty dump", () => {
    expect(parseTopologyTokens("")).toEqual({});
  });
});

describe("reachableIds", () => {
  it("walks left/right from the root", () => {
    const links = {
      n0: { left: "n2", right: "n1" },
      n1: {},
      n2: { left: "n6", right: "n5" },
      n5: {},
      n6: {},
    };
    expect([...reachableIds(links)].sort()).toEqual(["n0", "n1", "n2", "n5", "n6"]);
  });
});

describe("deletedIds", () => {
  it("reports base ids that are no longer reachable", () => {
    const base = ["n0", "n1", "n2", "n3"];
    const links = {
      n0: { left: "n2" },
      n2: {},
    };
    expect(deletedIds(base, links).sort()).toEqual(["n1", "n3"]);
  });
});

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
    const visible = model.edges.filter((e) => e.role === "normal");
    expect(visible).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "n0", to: "n2" }),
        expect.objectContaining({ from: "n0", to: "n1" }),
        expect.objectContaining({ from: "n1", to: "n4" }),
        expect.objectContaining({ from: "n1", to: "n3" }),
        expect.objectContaining({ from: "n2", to: "n6" }),
        expect.objectContaining({ from: "n2", to: "n5" }),
      ]),
    );
    expect(model.links).toEqual(inverted);
    expect(liveNodes(model)).toHaveLength(7);
  });

  it("drops an unlinked child and keeps a null-side scaffold", () => {
    const base = parseBinaryTree([4, 2, 7, 1, 3], "root");
    const links = {
      n0: { left: "n1", right: "n2" },
      n1: { right: "n4" },
      n2: {},
      n4: {},
    };
    const model = applyTopology(base, links);
    expect(liveNodes(model).map((n) => n.id).sort()).toEqual(["n0", "n1", "n2", "n4"]);
    expect(model.nodes.some((n) => n.id === "n1_L" && n.role === "null")).toBe(true);
    expect(model.edges.some((e) => e.from === "n1" && e.to === "n4" && e.role === "normal")).toBe(
      true,
    );
  });

  it("rebuilds reversed list edges and keeps every node", () => {
    const base = parseLinkedList([1, 2, 3, 4, 5], "head");
    const reversed = {
      n0: {},
      n1: { left: "n0" },
      n2: { left: "n1" },
      n3: { left: "n2" },
      n4: { left: "n3" },
    };
    const model = applyTopology(base, reversed);
    expect(model.kind).toBe("linked-list");
    expect(liveNodes(model).map((n) => n.id)).toEqual(["n0", "n1", "n2", "n3", "n4"]);
    expect(model.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "n4", to: "n3", role: "normal" }),
        expect.objectContaining({ from: "n3", to: "n2", role: "normal" }),
        expect.objectContaining({ from: "n2", to: "n1", role: "normal" }),
        expect.objectContaining({ from: "n1", to: "n0", role: "normal" }),
        expect.objectContaining({ from: "n0", to: "tail", role: "normal" }),
      ]),
    );
  });

  it("keeps a split list visible while reverse is mid-flight", () => {
    const base = parseLinkedList([1, 2, 3], "head");
    const mid = {
      n0: {},
      n1: { left: "n2" },
      n2: {},
    };
    const model = applyTopology(base, mid);
    expect(model.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "n0", to: "tail" }),
        expect.objectContaining({ from: "n1", to: "n2" }),
        expect.objectContaining({ from: "n2", to: "tail" }),
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
    expect(model.ranks[2]?.ids).toEqual(expect.arrayContaining(["n4", "n5"]));
    expect(model.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ from: "n4", to: "n5", role: "normal" }),
        expect.objectContaining({ from: "n0", to: "n2", role: "spine" }),
        expect.objectContaining({ from: "n2", to: "n4", role: "spine" }),
      ]),
    );
  });
});
