import { describe, expect, it } from "vitest";

import { EMPTY_STAGE_COPY, isEmptyStage } from "./emptyStage.js";

describe("EMPTY_STAGE_COPY", () => {
  it("tells the user to run code before a graph appears", () => {
    expect(EMPTY_STAGE_COPY).toBe("Run your code to see the graph.");
  });
});

describe("isEmptyStage", () => {
  it("treats missing input as no nodes", () => {
    expect(isEmptyStage({ caseInput: "", nodeCount: 0, hasFailure: false })).toBe(true);
  });

  it("treats a parsed graph with zero visible nodes as no nodes", () => {
    expect(isEmptyStage({ caseInput: "[]", nodeCount: 0, hasFailure: false })).toBe(true);
  });

  it("does not hide a parse failure behind the empty prompt", () => {
    expect(isEmptyStage({ caseInput: "foo", nodeCount: 0, hasFailure: true })).toBe(false);
  });
});
