import { describe, expect, it } from "vitest";

import type { GraphModel } from "../types.js";
import { graphForm, graphLabel, parseGraph } from "./graph.js";

function summary(model: GraphModel) {
  return {
    directed: model.directed,
    nodes: model.nodes.map((node) => `${node.id}:${node.label}`),
    edges: model.edges.map((edge) => `${edge.from}${edge.undirected ? "-" : ">"}${edge.to}${edge.label ? `:${edge.label}` : ""}`),
  };
}

describe("graphForm", () => {
  it("reads edge lists, adjacency lists and adjacency matrices", () => {
    expect(graphForm([[1, 0]], { name: "prerequisites" })).toBe("edges");
    expect(graphForm([[1, 2], [3], [3], []], { name: "graph" })).toBe("adjacency");
    expect(graphForm([[1, 1, 0], [1, 1, 0], [0, 0, 1]], { name: "isConnected" })).toBe("matrix");
    expect(graphForm([[2, 4], [1, 3], [2, 4], [1, 3]], { name: "node", type: "Optional['Node']" })).toBe("adjacency");
    expect(graphForm([[1, 2], [3], []])).toBe("adjacency");
    expect(graphForm([[0, 1], [1, 2]])).toBe("edges");
  });

  it("rejects shapes that do not fit the parameter name", () => {
    expect(graphForm([[1, 2, 3, 4]], { name: "edges" })).toBeUndefined();
    expect(graphForm([[2147483647, -1], [0, 5]], { name: "rooms" })).toBeUndefined();
    expect(graphForm([1, 2, 3])).toBeUndefined();
  });
});

describe("parseGraph", () => {
  it("adds isolated nodes from the count and keeps directed edges as given", () => {
    expect(summary(parseGraph([[1, 0], [2, 0]], "b", { name: "prerequisites", count: 4 }))).toEqual({
      directed: true,
      nodes: ["b0:0", "b1:1", "b2:2", "b3:3"],
      edges: ["b1>b0", "b2>b0"],
    });
  });

  it("switches to 1-indexed labels when an endpoint equals the count", () => {
    expect(summary(parseGraph([[1, 3], [2, 3]], "b", { name: "trust", count: 3 })).nodes).toEqual(["b0:1", "b1:2", "b2:3"]);
  });

  it("labels weighted edges and merges undirected duplicates", () => {
    expect(summary(parseGraph([[0, 1, 5], [1, 0, 5], [1, 2, 7]], "a", { name: "edges" }))).toEqual({
      directed: false,
      nodes: ["a0:0", "a1:1", "a2:2"],
      edges: ["a0-a1:5", "a1-a2:7"],
    });
  });

  it("uses string labels in first-seen order", () => {
    expect(summary(parseGraph([["MUC", "LHR"], ["JFK", "MUC"]], "a", { name: "tickets" })).nodes).toEqual(["a0:MUC", "a1:LHR", "a2:JFK"]);
  });

  it("draws symmetric adjacency lists undirected and asymmetric ones directed", () => {
    expect(summary(parseGraph([[1, 2], [0], [0]], "a", { name: "graph" }))).toEqual({
      directed: false,
      nodes: ["a0:0", "a1:1", "a2:2"],
      edges: ["a0-a1", "a0-a2"],
    });
    expect(summary(parseGraph([[1, 2], [3], [3], []], "a", { name: "graph" })).edges).toEqual(["a0>a1", "a0>a2", "a1>a3", "a2>a3"]);
  });

  it("numbers Node adjacency lists from 1 and reads 0/1 matrices without self loops", () => {
    expect(summary(parseGraph([[2], [1]], "a", { name: "node", type: "Node" }))).toEqual({
      directed: false,
      nodes: ["a0:1", "a1:2"],
      edges: ["a0-a1"],
    });
    expect(summary(parseGraph([[1, 1, 0], [1, 1, 0], [0, 0, 1]], "a", { name: "isConnected" })).edges).toEqual(["a0-a1"]);
  });

  it("matches labels the way the tracer prints them", () => {
    expect(graphLabel("New York, NY")).toBe("New_York__NY");
  });
});
