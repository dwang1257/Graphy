import { describe, expect, it } from "vitest";

import { resolveStructureKind, structureKindOptions } from "./structureKind.js";

describe("resolveStructureKind", () => {
  it("defaults a missing override to binary tree", () => {
    expect(resolveStructureKind(undefined)).toBe("binary-tree");
  });

  it("keeps a saved structure override", () => {
    expect(resolveStructureKind("linked-list")).toBe("linked-list");
    expect(resolveStructureKind("matrix")).toBe("matrix");
  });
});

describe("structureKindOptions", () => {
  it("lists only concrete structures, starting with binary tree", () => {
    expect(structureKindOptions()).toEqual([
      ["binary-tree", "Binary tree"],
      ["linked-list", "Linked list"],
      ["matrix", "Grid"],
    ]);
  });
});
