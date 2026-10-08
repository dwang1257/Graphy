import { describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../../settings/schema.js";
import type { GraphModel } from "../types.js";
import { emitDot } from "./emit.js";
import { PLACEHOLDER, roleOfPlaceholder } from "./paintRoles.js";

const options = { layout: DEFAULT_SETTINGS.layout };

function model(patch: Partial<GraphModel>): GraphModel {
  return { kind: "linked-list", directed: true, nodes: [], edges: [], ranks: [], ...patch };
}

describe("emitDot", () => {
  it("draws a lone empty marker for an empty scene", () => {
    expect(emitDot(model({}), options)).toContain('empty [shape="plaintext"');
  });

  it("renders title nodes as small plaintext in the edge text color", () => {
    const dot = emitDot(model({ nodes: [{ id: "t_a", label: "list1", role: "title" }] }), options);
    expect(dot).toContain(`"t_a" [label="list1", shape="plaintext", style="", fontcolor="${PLACEHOLDER.edgeText}"`);
  });

  it("paints with role placeholders so the DOT only carries geometry", () => {
    const dot = emitDot(model({
      kind: "binary-tree",
      nodes: [
        { id: "a0", label: "1", role: "root" },
        { id: "a1", label: "2", role: "normal" },
        {
          id: "b_grid",
          label: "",
          role: "normal",
          matrix: { showIndices: true, rows: [[{ text: "1", filled: true }, { text: "0", filled: false }]] },
        },
      ],
      edges: [{ from: "a0", to: "a1", role: "normal" }, { from: "a1", to: "a0", role: "cycle" }],
    }), options);
    const colors = [...dot.matchAll(/(?:color|COLOR)="(#[0-9a-f]{6})"/gi)].map((match) => match[1]!);
    expect(colors.length).toBeGreaterThan(0);
    expect(colors.every((color) => roleOfPlaceholder(color) !== undefined)).toBe(true);
    for (const role of ["nodeFill", "nodeStroke", "nodeInk", "rootFill", "rootInk", "edge", "cycle", "cellFill", "cellEmptyFill", "cellStroke", "cellText", "gutterText"] as const) {
      expect(dot).toContain(PLACEHOLDER[role]);
    }
    for (const palette of [DEFAULT_SETTINGS.light, DEFAULT_SETTINGS.dark]) {
      expect(dot).not.toContain(palette.nodeFill);
      expect(dot).not.toContain(palette.edgeColor);
    }
  });

  it("uses the layout font family for every label", () => {
    const dot = emitDot(model({}), { layout: { ...DEFAULT_SETTINGS.layout, fontFamily: "Inter Tight" } });
    expect(dot.match(/fontname="Inter Tight"/g)).toHaveLength(3);
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

describe("graph edges", () => {
  it("drops arrowheads on undirected edges and passes the layout engine through", () => {
    const dot = emitDot(model({
      kind: "graph",
      engine: "neato",
      nodes: [{ id: "a0", label: "0", role: "normal" }, { id: "a1", label: "1", role: "normal" }],
      edges: [{ from: "a0", to: "a1", role: "normal", label: "4", undirected: true }],
    }), options);

    expect(dot).toContain('layout="neato", overlap="false", pack="true"');
    expect(dot).toContain('"a0" -> "a1" [label="4", dir="none"]');
  });
});
