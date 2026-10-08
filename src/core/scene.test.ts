import { describe, expect, it } from "vitest";

import { parseBinaryTree } from "./parse/binaryTree.js";
import { parseLinkedLists } from "./parse/linkedList.js";
import { parseGraph } from "./parse/graph.js";
import { parseMatrix } from "./parse/matrix.js";
import { initialTopology, layoutKeyOf, sceneModel, type SceneTopology } from "./scene.js";
import type { GraphModel, Links, Pane } from "./types.js";

const opts = { showTerminal: true };

function treePane(values: Array<number | null>, id = "a", title = "root"): Pane {
  return { id, title, model: parseBinaryTree(values, title, id) };
}

function listPane(values: number[], id = "a", title = "head", cyclePos?: number): Pane {
  return { id, title, model: parseLinkedLists([values], { title, cyclePos }, id) };
}

function summary(model: GraphModel) {
  return {
    nodes: model.nodes.map((n) => `${n.id}:${n.role}`),
    edges: model.edges.map((e) => `${e.from}>${e.to}:${e.role}`),
    ranks: model.ranks.map((r) => r.ids.join(",")),
  };
}

function edit(topology: SceneTopology, change: { links?: Links; deleted?: string[]; alloc?: Array<[string, "tree" | "list", string]> }): SceneTopology {
  const nodes = { ...topology.nodes };
  const order = [...topology.order];
  for (const [id, kind, label] of change.alloc ?? []) {
    nodes[id] = { id, kind, label, root: false };
    order.push(id);
  }
  return {
    order,
    nodes,
    links: { ...topology.links, ...change.links },
    deleted: new Set([...topology.deleted, ...(change.deleted ?? [])]),
  };
}

function edgesOf(model: GraphModel): string[] {
  return model.edges.filter((e) => e.role !== "spine" && e.role !== "null").map((e) => `${e.from}>${e.to}${e.role === "cycle" ? "(cycle)" : ""}`);
}

function rowsOf(model: GraphModel): string[] {
  return model.ranks.map((r) => r.ids.join(" "));
}

describe("sceneModel trees", () => {
  it("lays out one tree exactly like the original slot scaffolding", () => {
    const pane = treePane([1, 2, 3, null, 4, 5, null, null, null, 6]);
    expect(summary(sceneModel([pane], initialTopology([pane]), opts))).toEqual({
      nodes: ["a0:root", "a1:normal", "a2:normal", "a4:normal", "a5:normal", "a9:normal", "s_a0:spine", "s_a1:spine", "a1_L:null", "s_a2:spine", "a2_R:null", "s_a5:spine", "a5_R:null"],
      edges: ["a0>a1:normal", "a0>s_a0:spine", "a1>a1_L:null", "a2>a5:normal", "a5>a9:normal", "a0>a2:normal", "a1>s_a1:spine", "a1>a4:normal", "a2>s_a2:spine", "a2>a2_R:null", "a5>s_a5:spine", "a5>a5_R:null"],
      ranks: ["a1,s_a0,a2", "a1_L,s_a1,a4", "a5,s_a2,a2_R", "a9,s_a5,a5_R", "a1,a2,s_a0", "a4,a5,a1_L,s_a1,a2_R,s_a2", "a9,a5_R,s_a5"],
    });
  });

  it("titles each pane when two trees are drawn and orders heads by pane", () => {
    const panes = [treePane([1, 2], "a", "p"), treePane([3], "b", "q")];
    const model = sceneModel(panes, initialTopology(panes), opts);
    expect(model.nodes.filter((n) => n.role === "title").map((n) => `${n.id}:${n.label}`)).toEqual(["t_a:p", "t_b:q"]);
    expect(model.nodes.filter((n) => n.role === "root").map((n) => n.id)).toEqual(["a0", "b0"]);
    expect(model.edges).toContainEqual({ from: "t_a", to: "a0", role: "spine" });
  });

  it("draws no titles for a single pane", () => {
    const pane = treePane([1, 2]);
    expect(sceneModel([pane], initialTopology([pane]), opts).nodes.some((n) => n.role === "title")).toBe(false);
  });

  it("floats a detached subtree as its own tree and drops deleted nodes", () => {
    const pane = treePane([5, 3, 6, 2, 4]);
    const base = initialTopology([pane]);
    const detached = sceneModel([pane], edit(base, { links: { a0: { right: "a2" } } }), opts);
    expect(detached.nodes.filter((n) => n.role !== "spine" && n.role !== "null").map((n) => n.id)).toEqual(["a0", "a2", "a1", "a3", "a4"]);
    expect(detached.ranks).toContainEqual({ ids: ["a0", "a1"] });
    const gone = sceneModel([pane], edit(base, { links: { a0: { right: "a2" } }, deleted: ["a1"] }), opts);
    expect(gone.nodes.map((n) => n.id)).not.toContain("a1");
    expect(gone.nodes.filter((n) => n.role === "root").map((n) => n.id)).toEqual(["a0"]);
  });

  it("floats an allocated node until it is linked", () => {
    const pane = treePane([4, 2, 7]);
    const base = initialTopology([pane]);
    const floating = edit(base, { alloc: [["z0", "tree", "5"]] });
    expect(edgesOf(sceneModel([pane], floating, opts))).toEqual(["a0>a1", "a0>a2"]);
    const linked = edit(floating, { links: { a2: { left: "z0" } } });
    expect(edgesOf(sceneModel([pane], linked, opts)).sort()).toEqual(["a0>a1", "a0>a2", "a2>z0"]);
  });

  it("marks an edge back to an already placed node as a cycle", () => {
    const pane = treePane([1, 2]);
    const cyclic = edit(initialTopology([pane]), { links: { a1: { right: "a0" } } });
    expect(edgesOf(sceneModel([pane], cyclic, opts))).toEqual(["a0>a1", "a1>a0(cycle)"]);
  });
});

describe("sceneModel lists", () => {
  it("draws one row with a terminal only after a null next", () => {
    const pane = listPane([1, 2, 3]);
    const model = sceneModel([pane], initialTopology([pane]), opts);
    expect(rowsOf(model)).toEqual(["a0 a1 a2 a2~"]);
    expect(rowsOf(sceneModel([pane], initialTopology([pane]), { showTerminal: false }))).toEqual(["a0 a1 a2"]);
  });

  it("splits a half reversed list into two rows", () => {
    const pane = listPane([1, 2, 3, 4]);
    const mid = edit(initialTopology([pane]), { links: { a0: {}, a1: { next: "a0" } } });
    expect(rowsOf(sceneModel([pane], mid, opts))).toEqual(["a1 a0 a0~", "a2 a3 a3~"]);
  });

  it("puts a dummy chain in one row ahead of the leftovers", () => {
    const panes = [listPane([1, 2], "a", "list1"), listPane([1, 3], "b", "list2")];
    const merged = edit(initialTopology(panes), {
      alloc: [["z0", "list", "0"]],
      links: { z0: { next: "a0" }, a0: { next: "b0" } },
    });
    const model = sceneModel(panes, merged, opts);
    expect(rowsOf(model)).toEqual(["z0 a0 b0 b1 b1~", "a1 a1~"]);
    expect(model.nodes.some((n) => n.role === "title")).toBe(false);
  });

  it("titles two list panes at the start of their rows", () => {
    const panes = [listPane([1], "a", "list1"), listPane([2], "b", "list2")];
    expect(rowsOf(sceneModel(panes, initialTopology(panes), opts))).toEqual(["t_a a0 a0~", "t_b b0 b0~"]);
  });

  it("draws the cycle edge from pos", () => {
    const pane = listPane([3, 2, 0, -4], "a", "head", 1);
    const model = sceneModel([pane], initialTopology([pane]), opts);
    expect(edgesOf(model)).toEqual(["a0>a1", "a1>a2", "a2>a3", "a3>a1(cycle)"]);
    expect(rowsOf(model)).toEqual(["a0 a1 a2 a3"]);
  });

  it("keeps an edge into another row loose", () => {
    const pane = listPane([1, 2, 3]);
    const shared = edit(initialTopology([pane]), { alloc: [["z0", "list", "9"]], links: { z0: { next: "a2" } } });
    const model = sceneModel([pane], shared, opts);
    expect(model.edges).toContainEqual({ from: "z0", to: "a2", role: "normal", constraint: false });
  });
});

describe("sceneModel grids and empties", () => {
  it("adds one table node per matrix pane with a title when other panes exist", () => {
    const grid: Pane = { id: "b", title: "grid", model: parseMatrix([[1, 0]], "grid") };
    const panes = [treePane([1]), grid];
    const model = sceneModel(panes, initialTopology(panes), opts);
    expect(model.nodes.find((n) => n.id === "b_grid")?.matrix?.rows).toHaveLength(1);
    expect(model.nodes.map((n) => n.id)).toEqual(expect.arrayContaining(["t_a", "t_b", "b_grid"]));
  });

  it("marks empty panes with their own terminal only when several panes are drawn", () => {
    const panes = [listPane([], "a", "list1"), listPane([0], "b", "list2")];
    const model = sceneModel(panes, initialTopology(panes), opts);
    expect(model.nodes.find((n) => n.id === "a_empty")).toEqual({ id: "a_empty", label: "∅", role: "terminal" });
    const single = listPane([]);
    expect(sceneModel([single], initialTopology([single]), opts).nodes).toEqual([]);
  });

  it("stacks an empty list pane as its own titled row in pane order", () => {
    const panes = [listPane([], "a", "list1"), listPane([0], "b", "list2")];
    const model = sceneModel(panes, initialTopology(panes), opts);
    expect(model.ranks).toContainEqual({ ids: ["t_a", "a_empty"] });
    expect(model.ranks).toContainEqual({ ids: ["t_b", "b0", "b0~"] });
    expect(model.edges).toContainEqual({ from: "a_empty", to: "b0", role: "spine" });
  });
});

describe("layoutKeyOf", () => {
  it("changes with structure but not with frame labels", () => {
    const pane = treePane([1, 2, 3]);
    const base = initialTopology([pane]);
    expect(layoutKeyOf(edit(base, {}))).toBe(layoutKeyOf(base));
    expect(layoutKeyOf(edit(base, { links: { a0: { left: "a1" } } }))).not.toBe(layoutKeyOf(base));
    expect(layoutKeyOf(edit(base, { deleted: ["a2"], links: { a0: { left: "a1" } } }))).toBe(
      layoutKeyOf(edit(base, { deleted: ["a2"] })),
    );
  });
});

describe("graph scenes", () => {
  it("copies graph nodes and edges and lays undirected graphs out with neato", () => {
    const pane: Pane = { id: "a", title: "edges", model: parseGraph([[0, 1], [1, 2]], "a", { name: "edges" }) };
    const model = sceneModel([pane], initialTopology([pane]), opts);

    expect(model.kind).toBe("graph");
    expect(model.engine).toBe("neato");
    expect(model.nodes.map((node) => node.id)).toEqual(["a0", "a1", "a2"]);
    expect(model.edges.map((edge) => [edge.from, edge.to, edge.undirected])).toEqual([["a0", "a1", true], ["a1", "a2", true]]);
  });

  it("keeps dot for directed graphs and titles graphs that share the stage", () => {
    const graph: Pane = { id: "b", title: "prerequisites", model: parseGraph([[1, 0]], "b", { name: "prerequisites" }) };
    const model = sceneModel([treePane([1, 2]), graph], initialTopology([treePane([1, 2]), graph]), opts);

    expect(model.engine).toBeUndefined();
    expect(model.nodes.filter((node) => node.role === "title").map((node) => node.label)).toEqual(["root", "prerequisites"]);
  });
});
