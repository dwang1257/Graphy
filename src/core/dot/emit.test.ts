import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../../settings/schema.js";
import type { GraphModel } from "../types.js";
import { emitDot } from "./emit.js";

const options = { palette: DEFAULT_SETTINGS.light, layout: DEFAULT_SETTINGS.layout };

function model(patch: Partial<GraphModel>): GraphModel {
  return { kind: "linked-list", directed: true, nodes: [], edges: [], ranks: [], ...patch };
}

describe("emitDot", () => {
  it("draws a lone empty marker for an empty scene", () => {
    expect(emitDot(model({}), options)).toContain('empty [shape="plaintext"');
  });

  it("renders title nodes as small plaintext in the edge text color", () => {
    const dot = emitDot(model({ nodes: [{ id: "t_a", label: "list1", role: "title" }] }), options);
    expect(dot).toContain(`"t_a" [label="list1", shape="plaintext", style="", fontcolor="${DEFAULT_SETTINGS.light.edgeText}"`);
  });

  it("shrinks terminal glyphs to their text so the arrow meets them", () => {
    const dot = emitDot(model({ nodes: [{ id: "a2~", label: "∅", role: "terminal" }] }), options);
    expect(dot).toContain("width=0, height=0, margin=0]");
  });

  it("keeps row titles sized to their text and collapses titles above a structure", () => {
    const dot = emitDot(model({
      nodes: [{ id: "t_a", label: "list1", role: "title" }, { id: "t_b", label: "p", role: "title" }],
      ranks: [{ ids: ["t_a", "a0"] }],
    }), options);
    expect(dot).toMatch(/"t_a" \[[^\]]*height=0, margin=0, width=0\]/);
    expect(dot).toMatch(/"t_b" \[[^\]]*height=0, margin=0, fixedsize="true"\]/);
  });

  it("renders matrix nodes as tables with pane scoped cell links", () => {
    const dot = emitDot(model({
      kind: "matrix",
      nodes: [{
        id: "b_grid",
        label: "",
        role: "normal",
        matrix: { showIndices: false, rows: [[{ text: "1", filled: true }, { text: "0", filled: false }]] },
      }],
    }), options);
    expect(dot).toContain('"b_grid" [shape="plaintext", style="", label=<<TABLE');
    expect(dot).toContain('HREF="graphy://cell/b/0/1"');
  });

  it("keeps loose edges out of the ranking and orders tree children", () => {
    const loose = { from: "z0", to: "a2", role: "normal" as const, constraint: false as const };
    expect(emitDot(model({ edges: [loose] }), options)).toContain('"z0" -> "a2" [constraint="false"]');
    expect(emitDot(model({ kind: "binary-tree" }), options)).toContain('ordering="out"');
    expect(emitDot(model({}), options)).not.toContain("ordering");
  });
});
