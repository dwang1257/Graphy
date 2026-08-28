import { describe, expect, it } from "vitest";

import { detectRole } from "./detect.js";

describe("detectRole", () => {
  it("detects neighbor rows as an adjacency list from shape", () => {
    expect(detectRole(undefined, [[2, 4], [1, 3], [2, 4], [1, 3]])).toEqual({
      kind: "adjacency",
    });
  });

  it("detects pairs forming a triangle as an undirected graph from shape", () => {
    expect(detectRole(undefined, [[0, 1], [1, 2], [2, 0]])).toEqual({
      kind: "graph",
      directed: false,
    });
  });

  it("maps the isConnected parameter name to a matrix", () => {
    expect(
      detectRole(
        { name: "isConnected", type: "number[][]" },
        [[1, 1, 0], [1, 1, 0], [0, 0, 1]],
      ),
    ).toEqual({ kind: "matrix" });
  });
});
