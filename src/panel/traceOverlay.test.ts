/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";

import { applyTraceOverlay, clearTraceOverlay } from "./traceOverlay.js";
import type { TraceFrame } from "../core/trace.js";

function svgDoc(markup: string): Document {
  return new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,
    "image/svg+xml",
  );
}

describe("applyTraceOverlay", () => {
  it("marks current, visited, and frontier nodes by title id", () => {
    const doc = svgDoc(`
      <g id="node1" class="node"><title>n0</title><ellipse /></g>
      <g id="node2" class="node"><title>n1</title><ellipse /></g>
      <g id="node3" class="node"><title>n2</title><ellipse /></g>
    `);
    const frame: TraceFrame = {
      current: "n1",
      visited: ["n0"],
      frontier: ["n2"],
      line: 1,
      label: "current n1",
    };
    applyTraceOverlay(doc.documentElement, frame);

    expect(doc.querySelector('g.node[data-graphy-id="n0"]')?.getAttribute("data-graphy-state")).toContain(
      "visited",
    );
    expect(doc.querySelector('g.node[data-graphy-id="n1"]')?.getAttribute("data-graphy-state")).toContain(
      "current",
    );
    expect(doc.querySelector('g.node[data-graphy-id="n2"]')?.getAttribute("data-graphy-state")).toContain(
      "frontier",
    );
  });

  it("marks matrix cells by graphy href", () => {
    const doc = svgDoc(`
      <a data-graphy-href="graphy://cell/0/1"><polygon /></a>
      <a href="graphy://cell/1/0"><polygon /></a>
    `);
    applyTraceOverlay(doc.documentElement, {
      current: "cell:0,1",
      visited: ["cell:1,0"],
      frontier: [],
      line: 1,
      label: "current 0,1",
    });
    expect(doc.querySelector('a[data-graphy-id="cell:0,1"]')?.getAttribute("data-graphy-state")).toContain(
      "current",
    );
    expect(doc.querySelector('a[data-graphy-id="cell:1,0"]')?.getAttribute("data-graphy-state")).toContain(
      "visited",
    );
  });

  it("records whether each marked node is light or dark so CSS can dim or lift", () => {
    const doc = svgDoc(`
      <g class="node"><title>n0</title><ellipse fill="#eef2ff" /></g>
      <g class="node"><title>n1</title><ellipse fill="#312e81" /></g>
      <g class="node"><title>n2</title><ellipse fill="url(#graphy-node-bg)" /></g>
    `);
    doc.documentElement.setAttribute("data-graphy-image-tone", "light");
    applyTraceOverlay(doc.documentElement, {
      current: "n1",
      visited: ["n0", "n2"],
      frontier: [],
      line: 1,
      label: "current n1",
    });
    expect(doc.querySelector('g.node[data-graphy-id="n0"]')?.getAttribute("data-graphy-tone")).toBe(
      "light",
    );
    expect(doc.querySelector('g.node[data-graphy-id="n1"]')?.getAttribute("data-graphy-tone")).toBe(
      "dark",
    );
    expect(doc.querySelector('g.node[data-graphy-id="n2"]')?.getAttribute("data-graphy-tone")).toBe(
      "light",
    );
  });

  it("clearTraceOverlay removes prior marks", () => {
    const doc = svgDoc(`<g class="node"><title>n0</title><ellipse /></g>`);
    applyTraceOverlay(doc.documentElement, {
      current: "n0",
      visited: [],
      frontier: [],
      line: 1,
      label: "current n0",
    });
    clearTraceOverlay(doc.documentElement);
    expect(doc.querySelector("[data-graphy-state]")).toBeNull();
    expect(doc.querySelector("[data-graphy-tone]")).toBeNull();
  });
});
