import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { NODE_LIMIT } from "../settings/schema.js";
import { EMPTY_STAGE_COPY, isEmptyStage, isTooLarge, tooLargeCopy } from "./emptyStage.js";

const css = readFileSync(new URL("./styles.css", import.meta.url), "utf8");

describe("EMPTY_STAGE_COPY", () => {
  it("tells the user to run code before a graph appears", () => {
    expect(EMPTY_STAGE_COPY).toBe("Run your code to see the graph.");
  });

  it("paints non-error placeholder copy with stage ink, a halo, and heavy weight", () => {
    const block = css.match(/\.placeholder p \{[^}]+\}/)?.[0] ?? "";
    expect(block).toMatch(/font-weight: (700|800)/);
    expect(block).toMatch(/color: var\(--stage-ink\)/);
    expect(block).toMatch(/text-shadow:[\s\S]*var\(--stage-halo\)/);
  });

  it("keeps error placeholder copy danger-colored without a stage halo", () => {
    const block = css.match(/\.placeholder\.error p \{[^}]+\}/)?.[0] ?? "";
    expect(block).toMatch(/color: var\(--color-danger\)/);
    expect(block).not.toMatch(/var\(--stage-ink\)/);
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
