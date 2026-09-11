import { describe, expect, it } from "vitest";

import { DARK_INK, LIGHT_INK } from "../../panel/imageInk.js";
import { DEFAULT_LAYOUT, LIGHT } from "../../settings/schema.js";
import type { GraphModel } from "../types.js";
import { emitDot } from "./emit.js";

function emit(palette: Partial<typeof LIGHT>, model: Pick<GraphModel, "nodes">): string {
  return emitDot(
    { kind: "linked-list", directed: true, nodes: model.nodes, edges: [], ranks: [] },
    { palette: { ...LIGHT, ...palette }, layout: DEFAULT_LAYOUT },
  );
}

function nodeAttrs(dot: string): string {
  const line = dot.split("\n").find((row) => row.trim().startsWith("node ["));
  if (!line) throw new Error("expected a default node [] line");
  return line;
}

function nodeLine(dot: string, id: string): string {
  const line = dot.split("\n").find((row) => row.includes(`"${id}" [`));
  if (!line) throw new Error(`expected a node line for ${id}`);
  return line;
}

describe("emitDot label contrast from solid fills", () => {
  it("uses dark fontcolor when nodeFill is light", () => {
    const dot = emit(
      { nodeFill: "#f8fafc", nodeText: "#f8fafc" },
      { nodes: [{ id: "n0", label: "1", role: "normal" }] },
    );
    expect(nodeAttrs(dot)).toContain(`fontcolor="${DARK_INK}"`);
  });

  it("uses light fontcolor when nodeFill is dark", () => {
    const dot = emit(
      { nodeFill: "#111827", nodeText: "#111827" },
      { nodes: [{ id: "n0", label: "1", role: "normal" }] },
    );
    expect(nodeAttrs(dot)).toContain(`fontcolor="${LIGHT_INK}"`);
  });

  it("uses dark fontcolor when rootFill is light", () => {
    const dot = emit(
      { rootFill: "#f8fafc" },
      { nodes: [{ id: "n0", label: "1", role: "root" }] },
    );
    expect(nodeLine(dot, "n0")).toContain(`fontcolor="${DARK_INK}"`);
  });

  it("uses light fontcolor when rootFill is dark", () => {
    const dot = emit(
      { rootFill: "#4f46e5" },
      { nodes: [{ id: "n0", label: "1", role: "root" }] },
    );
    expect(nodeLine(dot, "n0")).toContain(`fontcolor="${LIGHT_INK}"`);
  });

  it("leaves terminal labels on terminalText", () => {
    const dot = emit(
      { nodeFill: "#111827", terminalText: "#94a3b8" },
      { nodes: [{ id: "n0", label: "null", role: "terminal" }] },
    );
    expect(nodeLine(dot, "n0")).toContain('fontcolor="#94a3b8"');
  });
});
