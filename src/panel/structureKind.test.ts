import { describe, expect, it } from "vitest";

import {
  resolveStructureKind,
  structureKindLabel,
  structureKindOptions,
} from "./structureKind.js";

describe("resolveStructureKind", () => {
  it("leaves a missing override unselected", () => {
    expect(resolveStructureKind(undefined)).toBeUndefined();
  });

  it("keeps a saved structure override", () => {
    expect(resolveStructureKind("linked-list")).toBe("linked-list");
    expect(resolveStructureKind("matrix")).toBe("matrix");
  });
});

describe("structureKindLabel", () => {
  it("asks the user to choose before anything is picked", () => {
    expect(structureKindLabel(undefined)).toBe("Choose an Option:");
  });

  it("shows the chosen structure after a pick", () => {
    expect(structureKindLabel("binary-tree")).toBe("Binary tree");
  });
});

describe("structureKindOptions", () => {
  it("lists only concrete structures, starting with binary tree", () => {
    expect(structureKindOptions()).toEqual([
      ["binary-tree", "Binary tree"],
      ["linked-list", "Linked list"],
      ["matrix", "Graph"],
    ]);
  });
});
