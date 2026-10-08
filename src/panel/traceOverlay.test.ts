import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";

import type { TraceFrame } from "../core/trace.js";
import { initialTopology } from "../core/scene.js";
import { applyTraceOverlay, clearTraceOverlay, refreshTraceTones } from "./traceOverlay.js";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><g id="graph0" class="graph">
<g class="node"><title>a0</title><ellipse cx="20" cy="-30" rx="10" ry="12" fill="#fff"/><text x="20" y="-26">1</text></g>
<g class="node"><title>a1</title><polygon points="40,-10 60,-10 60,-30 40,-30" fill="#fff"/><text x="50" y="-16">2</text></g>
<g class="edge"><title>a0&#45;&gt;a1</title><path d="M0,0"/><polygon points="0,0 1,1"/></g>
<g class="node"><title>b_grid</title><a data-graphy-href="graphy://cell/b/0/1"><polygon points="0,0 1,1" fill="#eee"/></a><a data-graphy-href="graphy://cell/b/0/2"><polygon points="10,-20 10,-46 36,-46 36,-20 10,-20" fill="#eee" data-graphy-fill="cellFill"/><polygon fill="none" stroke="#000" points="10,-20 10,-46 36,-46 36,-20 10,-20" data-graphy-stroke="cellStroke"/><text text-anchor="start" x="19" y="-27">1</text></a></g>
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
    notes: {},
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

  it("rewrites grid cell values centered with their fill role and restores them on clear", () => {
    const root = svgRoot();
    const cell = root.querySelectorAll("a")[1]!;
    const text = cell.querySelector("text")!;
    applyTraceOverlay(root, frame({ labels: { "b0.2": "0" } }));
    expect([text.textContent, text.getAttribute("x"), text.getAttribute("text-anchor")]).toEqual(["0", "23", "middle"]);
    expect(cell.querySelector("polygon")?.getAttribute("data-graphy-fill")).toBe("cellEmptyFill");
    expect(cell.querySelectorAll("[data-graphy-fill]")).toHaveLength(1);
    applyTraceOverlay(root, frame({ labels: { "b0.2": "12" } }));
    expect(text.textContent).toBe("12");
    expect(cell.querySelector("polygon")?.getAttribute("data-graphy-fill")).toBe("cellFill");
    clearTraceOverlay(root);
    expect([text.textContent, text.getAttribute("x"), text.getAttribute("text-anchor")]).toEqual(["1", "19", "start"]);
    expect(cell.querySelector("polygon")?.getAttribute("data-graphy-fill")).toBe("cellFill");
    expect(root.querySelectorAll("[data-graphy-base-fill], [data-graphy-x], [data-graphy-anchor]")).toHaveLength(0);
  });

  it("outlines cells held by named pointers instead of drawing badges", () => {
    const root = svgRoot();
    applyTraceOverlay(root, frame({ current: "b0.2", pointers: { "r,c": "b0.1", "nr,nc": "b0.2" } }));
    const [held, probe] = root.querySelectorAll("a");
    expect(held?.getAttribute("data-graphy-state")).toBe("pointer");
    expect(probe?.getAttribute("data-graphy-state")).toBe("current pointer");
    expect(root.querySelectorAll(".graphy-pointer")).toHaveLength(0);
  });

  it("moves badges and values off the edges that meet a node", () => {
    const root = svgRoot();
    const edge = root.querySelector("g.edge")!;
    edge.querySelector("path")!.setAttribute("d", "M20,-80C20,-60 20,-50 20,-42");
    edge.insertAdjacentHTML("afterend", `<g class="edge"><title>a0&#45;&gt;a1</title><path d="M20,-30C40,-30 50,-30 50,-30"/></g>`);
    applyTraceOverlay(root, frame({ pointers: { node: "a0" }, note: "dist", notes: { dist: { a0: "7" } } }));
    const [badge, note] = [root.querySelector(".graphy-pointer")!, root.querySelector(".graphy-note")!];
    expect([badge.getAttribute("x"), badge.getAttribute("y"), badge.getAttribute("text-anchor")]).toEqual(["29.9", "-41.31", "start"]);
    expect([note.getAttribute("x"), note.getAttribute("y"), note.getAttribute("text-anchor")]).toEqual(["29.9", "-9.69", "start"]);
  });

  it("writes the active per-node value beside each node", () => {
    const root = svgRoot();
    applyTraceOverlay(root, frame({ note: "dist", notes: { dist: { a0: "3" }, indeg: { a1: "1" } } }));
    const notes = [...root.querySelectorAll(".graphy-note")];
    expect(notes.map((el) => [el.textContent, el.getAttribute("x"), el.getAttribute("y")])).toEqual([["3", "34", "-26"]]);
    clearTraceOverlay(root);
    expect(root.querySelectorAll(".graphy-note")).toHaveLength(0);
  });

  it("highlights the edge between the current node and another pointer", () => {
    const root = svgRoot();
    const edge = root.querySelector("g.edge")!;
    applyTraceOverlay(root, frame({ current: "a1", pointers: { u: "a0", v: "a1" } }));
    expect(edge.getAttribute("data-graphy-state")).toBe("active");
    applyTraceOverlay(root, frame({ current: "a1", pointers: { v: "a1" } }));
    expect(edge.getAttribute("data-graphy-state")).toBeNull();
  });

  it("refreshes marked tones after a repaint without touching states or labels", () => {
    const root = svgRoot();
    applyTraceOverlay(root, frame({ visited: ["a0", "a1"], labels: { a0: "9" } }));
    expect(node(root, "a0").getAttribute("data-graphy-tone")).toBe("light");
    node(root, "a0").querySelector("ellipse")?.setAttribute("fill", "#111111");
    refreshTraceTones(root);
    expect(node(root, "a0").getAttribute("data-graphy-tone")).toBe("dark");
    expect(node(root, "a1").getAttribute("data-graphy-tone")).toBe("light");
    expect(node(root, "a0").getAttribute("data-graphy-state")).toBe("visited");
    expect(node(root, "a0").querySelector("text")?.textContent).toBe("9");
  });
});
