import { describe, expect, it } from "vitest";

import {
  autoKindLabel,
  displayedStructureKind,
  pendingKindForSlug,
  structureKindLabel,
  structureKindOptions,
} from "./structureKind.js";

describe("structure kind selection", () => {
  it("does not carry a pending override across a slug change", () => {
    expect(pendingKindForSlug({ slug: "first", kind: "matrix" }, "second")).toBeUndefined();
    expect(displayedStructureKind("binary-tree", pendingKindForSlug({ slug: "first", kind: "matrix" }, "second"))).toBe("binary-tree");
  });

  it("lets a pending return to auto hide the saved override", () => {
    expect(displayedStructureKind("binary-tree", pendingKindForSlug({ slug: "same-tree", kind: null }, "same-tree"))).toBeUndefined();
    expect(displayedStructureKind("binary-tree", pendingKindForSlug({ slug: "same-tree", kind: "matrix" }, "same-tree"))).toBe("matrix");
  });

  it("ignores saved values that are not structure kinds", () => {
    expect(displayedStructureKind("array", undefined)).toBeUndefined();
  });
});

describe("structure kind labels", () => {
  it("labels the auto option with what detection found", () => {
    expect(autoKindLabel([])).toBe("Auto");
    expect(autoKindLabel([undefined, "binary-tree", "binary-tree"])).toBe("Auto (Binary tree)");
    expect(autoKindLabel(["linked-list", undefined, "matrix", "linked-list"])).toBe("Auto (Linked list + Graph)");
  });

  it("prefers the override, then detection, then the unselected prompt", () => {
    expect(structureKindLabel("matrix", ["binary-tree"])).toBe("Graph");
    expect(structureKindLabel(undefined, ["binary-tree", "linked-list"])).toBe("Binary tree + Linked list");
    expect(structureKindLabel(undefined, [undefined])).toBe("Choose a structure");
    expect(structureKindLabel(undefined)).toBe("Choose a structure");
  });

  it("lists explicit kinds in a stable order", () => {
    expect(structureKindOptions()).toEqual([
      ["binary-tree", "Binary tree"],
      ["linked-list", "Linked list"],
      ["matrix", "Graph"],
    ]);
  });
});
