import { expect, test } from "vitest";

import { buildPanes, selectPrimaryPane } from "./build.js";
import type { Pane, StructureKind } from "./types.js";

function pane(id: string, kind: StructureKind): Pane {
  return {
    id,
    title: id,
    model: {
      kind,
      directed: false,
      nodes: [],
      edges: [],
      ranks: [],
      notes: [],
    },
  };
}

test("selects the first visualizable pane by default", () => {
  const panes = [pane("tree", "binary-tree"), pane("grid", "matrix")];

  expect(selectPrimaryPane(panes)?.id).toBe("tree");
});

test("prefers a pane matching the structure override", () => {
  const panes = [pane("tree", "binary-tree"), pane("grid", "matrix")];

  expect(selectPrimaryPane(panes, "matrix")?.id).toBe("grid");
});

test("uses the signature parameter name for a visualized argument", () => {
  const result = buildPanes("[1,2,3]\n1", {
    method: "detectCycle",
    params: [
      { type: "ListNode*", name: "head" },
      { type: "int", name: "pos" },
    ],
  });

  expect(result.panes[0]?.title).toBe("head");
});

test("visualizes a complete tree when binary-tree is selected", () => {
  const result = buildPanes("[4,2,6,3,1,5]\n1\n2", null, { override: "binary-tree" });

  expect(result.failures).toEqual([]);
  expect(result.panes[0]?.model.kind).toBe("binary-tree");
  expect(result.panes[0]?.model.nodes.some((n) => n.role === "root")).toBe(true);
});

test("visualizes a sparse tree when binary-tree is selected", () => {
  const result = buildPanes("[4,2,null,3,1]\n1\n3", null, { override: "binary-tree" });

  expect(result.failures).toEqual([]);
  expect(result.panes[0]?.model.kind).toBe("binary-tree");
});
