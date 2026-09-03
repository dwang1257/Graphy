import { describe, expect, it } from "vitest";

import { detectRole } from "./detect.js";

describe("detectRole", () => {
  it("treats equal-width nested rows as a matrix from shape", () => {
    expect(detectRole(undefined, [[2, 4], [1, 3], [2, 4], [1, 3]])).toEqual({
      kind: "matrix",
    });
    expect(detectRole(undefined, [[0, 1], [1, 2], [2, 0]])).toEqual({
      kind: "matrix",
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
});
