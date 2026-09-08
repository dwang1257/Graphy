/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";

import { nodePositions } from "./graphMorph.js";

describe("nodePositions", () => {
  it("reads ellipse centers from Graphviz node groups", () => {
    const doc = new DOMParser().parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg">
        <g class="node"><title>n0</title><ellipse cx="10" cy="20" rx="5" ry="5"/></g>
        <g class="node"><title>n1</title><ellipse cx="40" cy="60" rx="5" ry="5"/></g>
        <g class="node"><title>s_n0</title><ellipse cx="0" cy="0" rx="1" ry="1"/></g>
      </svg>`,
      "image/svg+xml",
    );
    const positions = nodePositions(doc.documentElement);
    expect(positions.get("n0")).toEqual({ x: 10, y: 20 });
    expect(positions.get("n1")).toEqual({ x: 40, y: 60 });
    expect(positions.has("s_n0")).toBe(false);
  });
});
