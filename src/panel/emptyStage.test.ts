import { describe, expect, it } from "vitest";

import { NODE_LIMIT } from "../settings/schema.js";
import { EMPTY_STAGE_COPY, isEmptyStage, isTooLarge, tooLargeCopy } from "./emptyStage.js";

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

describe("node limit", () => {
  it("allows exactly 100 visible nodes", () => {
    expect(isTooLarge(NODE_LIMIT)).toBe(false);
  });

  it("refuses one node past the cap", () => {
    expect(isTooLarge(NODE_LIMIT + 1)).toBe(true);
    expect(tooLargeCopy(150)).toBe(
      "This graph has 150 nodes. Graphy only shows graphs with 100 nodes or fewer.",
    );
  });
});
