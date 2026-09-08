import { describe, expect, it } from "vitest";

import { parseBinaryTree } from "./parse/binaryTree.js";
import { deletedIds, parseTopologyTokens, reachableIds } from "./topology.js";
import { applyTopology } from "./treeModel.js";

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
    expect(model.nodes.filter((n) => n.role === "root" || n.role === "normal")).toHaveLength(7);
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
    const visibleIds = model.nodes
      .filter((n) => n.role === "root" || n.role === "normal")
      .map((n) => n.id)
      .sort();
    expect(visibleIds).toEqual(["n0", "n1", "n2", "n4"]);
    expect(model.nodes.some((n) => n.id === "n1_L" && n.role === "null")).toBe(true);
    expect(model.edges.some((e) => e.from === "n1" && e.to === "n4" && e.role === "normal")).toBe(
      true,
    );
  });
});
