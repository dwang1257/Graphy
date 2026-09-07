import { describe, expect, it } from "vitest";

import { isEmptyStage } from "./emptyStage.js";

describe("isEmptyStage", () => {
  it("treats missing input as no nodes", () => {
    expect(isEmptyStage({ caseInput: "", nodeCount: 0, hasFailure: false })).toBe(true);
  });

  it("treats a parsed graph with zero visible nodes as no nodes", () => {
    expect(isEmptyStage({ caseInput: "[]", nodeCount: 0, hasFailure: false })).toBe(true);
  });

  it("does not hide a parse failure behind No Nodes", () => {
    expect(isEmptyStage({ caseInput: "foo", nodeCount: 0, hasFailure: true })).toBe(false);
  });
});
