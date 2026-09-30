import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";

import type { TraceFrame } from "../core/trace.js";
import { initialTopology } from "../core/scene.js";
import { applyTraceOverlay, clearTraceOverlay } from "./traceOverlay.js";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g id="graph0" class="graph">
<g class="node"><title>a0</title><ellipse cx="20" cy="-30" rx="10" ry="12" fill="#fff"/><text x="20" y="-26">1</text></g>
<g class="node"><title>a1</title><polygon points="40,-10 60,-10 60,-30 40,-30" fill="#fff"/><text x="50" y="-16">2</text></g>
<g class="node"><title>b_grid</title><a data-graphy-href="graphy://cell/b/0/1"><polygon points="0,0 1,1" fill="#eee"/></a></g>
</g></svg>`;

function svgRoot(): Element {
  const window = new Window();
  const parser = new window.DOMParser();
  return parser.parseFromString(SVG, "image/svg+xml").documentElement as unknown as Element;
}

function frame(patch: Partial<TraceFrame>): TraceFrame {
  return {
    topology: initialTopology([]),
    layoutKey: "",
    labels: {},
    pointers: {},
    visited: [],
    frontier: [],
    dimmed: [],
    ...patch,
  };
}

function node(root: Element, id: string): Element {
  return [...root.querySelectorAll("g.node")].find((el) => el.querySelector("title")?.textContent === id)!;
}

describe("traceOverlay", () => {
  it("marks node and cell states", () => {
    const root = svgRoot();
    applyTraceOverlay(root, frame({ current: "a1", frontier: ["a0"], dimmed: ["a0"], visited: ["a0", "a1", "b0.1"] }));
    expect(node(root, "a0").getAttribute("data-graphy-state")).toBe("visited frontier dimmed");
    expect(node(root, "a1").getAttribute("data-graphy-state")).toBe("visited current");
    expect(root.querySelector("a")?.getAttribute("data-graphy-state")).toBe("visited");
    expect(root.querySelector("a")?.getAttribute("data-graphy-id")).toBe("b0.1");
  });

  it("rewrites labels and restores them on clear", () => {
    const root = svgRoot();
    applyTraceOverlay(root, frame({ labels: { a0: "9" } }));
    expect(node(root, "a0").querySelector("text")?.textContent).toBe("9");
    applyTraceOverlay(root, frame({ labels: { a1: "8" } }));
    expect(node(root, "a0").querySelector("text")?.textContent).toBe("1");
    expect(node(root, "a1").querySelector("text")?.textContent).toBe("8");
    clearTraceOverlay(root);
    expect(node(root, "a1").querySelector("text")?.textContent).toBe("2");
  });

  it("draws pointer badges above the node and removes them on clear", () => {
    const root = svgRoot();
    applyTraceOverlay(root, frame({ pointers: { prev: "a0", curr: "a1", a: "a1", b: "a1", c: "a1" } }));
    const badges = [...root.querySelectorAll(".graphy-pointer")];
    expect(badges.map((el) => [el.textContent, el.getAttribute("x"), el.getAttribute("y")])).toEqual([
      ["prev", "20", "-46"],
      ["curr, a, b, …", "50", "-34"],
    ]);
    expect(badges[0]?.parentElement?.getAttribute("class")).toBe("graph");
    clearTraceOverlay(root);
    expect(root.querySelectorAll(".graphy-pointer")).toHaveLength(0);
  });
});
