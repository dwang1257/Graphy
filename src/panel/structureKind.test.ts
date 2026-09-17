import { describe, expect, it } from "vitest";

import { displayedStructureKind, pendingKindForSlug } from "./structureKind.js";

describe("structure kind selection", () => {
  it("does not carry a pending override across a slug change", () => {
    expect(pendingKindForSlug({ slug: "first", kind: "matrix" }, "second")).toBeUndefined();
    expect(displayedStructureKind("binary-tree", pendingKindForSlug({ slug: "first", kind: "matrix" }, "second"))).toBe("binary-tree");
  });
});
