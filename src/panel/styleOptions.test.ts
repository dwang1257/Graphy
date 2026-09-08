import { describe, expect, it } from "vitest";

import { styleEdgeStyles, styleNodeShapes } from "./styleOptions.js";

describe("styleNodeShapes", () => {
  it("offers the drawable Graphviz shapes, not plaintext", () => {
    expect(styleNodeShapes()).toEqual([
      ["circle", "Circle"],
      ["ellipse", "Ellipse"],
      ["square", "Square"],
      ["diamond", "Diamond"],
      ["hexagon", "Hexagon"],
      ["doublecircle", "Double"],
    ]);
  });
});

describe("styleEdgeStyles", () => {
  it("offers solid, dashed, dotted, and bold edges", () => {
    expect(styleEdgeStyles()).toEqual([
      ["solid", "Solid"],
      ["dashed", "Dashed"],
      ["dotted", "Dotted"],
      ["bold", "Bold"],
    ]);
  });
});
