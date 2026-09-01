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
