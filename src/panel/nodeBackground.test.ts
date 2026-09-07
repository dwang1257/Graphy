/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";
import { IMAGE_TONE_ATTR } from "./imageInk.js";
import { applyNodeBackgroundImage } from "./nodeBackground.js";

const PHOTO = "data:image/png;base64,abc";

const GRAPHVIZ_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="80" height="160">
  <g id="graph0" class="graph">
    <g id="node1" class="node">
      <ellipse fill="#312e81" stroke="#818cf8" cx="18" cy="-90" rx="18" ry="18"/>
      <text fill="#e0e7ff">1</text>
    </g>
    <g id="node2" class="node">
      <ellipse fill="#312e81" stroke="#818cf8" cx="18" cy="-18" rx="18" ry="18"/>
      <text fill="#e0e7ff">2</text>
    </g>
    <g id="edge1" class="edge">
      <text fill="#cbd5e1">next</text>
    </g>
    <g id="node3" class="node">
      <ellipse fill="#64748b" stroke="#64748b" cx="40" cy="-18" rx="2" ry="2"/>
    </g>
  </g>
</svg>`;

function parseSvg(markup: string): Element {
  const document = new DOMParser().parseFromString(markup, "image/svg+xml");
  const error = document.querySelector("parsererror");
  if (error) throw new Error(error.textContent ?? "SVG parse error");
  return document.documentElement;
}

function patternImage(svg: Element): Element {
  const image = svg.querySelector("pattern#graphy-node-bg image");
  if (!image) throw new Error("expected a node-background pattern image");
  return image;
}

describe("node background image", () => {
  it("paints every filled node with the uploaded image, not an empty fill", () => {
    const svg = parseSvg(GRAPHVIZ_SVG);

    applyNodeBackgroundImage(svg, PHOTO);

    const pattern = svg.querySelector("pattern#graphy-node-bg");
    expect(pattern).not.toBeNull();
    expect(pattern!.getAttribute("patternUnits")).toBe("objectBoundingBox");
    expect(pattern!.getAttribute("patternContentUnits")).toBe("objectBoundingBox");
    expect(pattern!.getAttribute("width")).toBe("1");
    expect(pattern!.getAttribute("height")).toBe("1");

    const image = patternImage(svg);
    expect(image.getAttribute("href") ?? image.getAttribute("xlink:href")).toBe(PHOTO);
    expect(image.getAttribute("width")).toBe("1");
    expect(image.getAttribute("height")).toBe("1");

    const nodeFills = [...svg.querySelectorAll("g.node ellipse")].map((el) => el.getAttribute("fill"));
    expect(nodeFills).toEqual(["url(#graphy-node-bg)", "url(#graphy-node-bg)", "#64748b"]);
  });

  it("paints box and diamond polygons the same way", () => {
    const svg = parseSvg(`<svg xmlns="http://www.w3.org/2000/svg">
      <g class="node">
        <polygon fill="#eef2ff" stroke="black" points="54,-36 0,-36 0,0 54,0 54,-36"/>
      </g>
      <g class="node">
        <polygon fill="#eef2ff" stroke="black" points="27,-36 0,-18 27,0 54,-18 27,-36"/>
      </g>
    </svg>`);

    applyNodeBackgroundImage(svg, PHOTO);

    expect([...svg.querySelectorAll("g.node polygon")].map((el) => el.getAttribute("fill"))).toEqual([
      "url(#graphy-node-bg)",
      "url(#graphy-node-bg)",
    ]);
  });

  it("paints node outlines black and all labels with the contrast ink", () => {
    const svg = parseSvg(GRAPHVIZ_SVG);

    applyNodeBackgroundImage(svg, PHOTO, "#1e1b4b");

    expect([...svg.querySelectorAll("g.node ellipse")].map((el) => el.getAttribute("stroke"))).toEqual([
      "#000000",
      "#000000",
      "#64748b",
    ]);
    expect([...svg.querySelectorAll("text")].map((el) => el.getAttribute("fill"))).toEqual([
      "#1e1b4b",
      "#1e1b4b",
      "#1e1b4b",
    ]);
    expect(svg.getAttribute(IMAGE_TONE_ATTR)).toBe("light");
  });

  it("marks a dark photo so visited nodes can lift instead of shade", () => {
    const svg = parseSvg(GRAPHVIZ_SVG);
    applyNodeBackgroundImage(svg, PHOTO, "#f8fafc");
    expect(svg.getAttribute(IMAGE_TONE_ATTR)).toBe("dark");
  });

  it("keeps the image URL after the GraphView serialize round-trip", () => {
    const svg = parseSvg(GRAPHVIZ_SVG);
    applyNodeBackgroundImage(svg, PHOTO);

    const serialized = new XMLSerializer().serializeToString(svg);
    const again = parseSvg(serialized);
    const image = patternImage(again);

    expect(image.getAttribute("href") ?? image.getAttribute("xlink:href")).toBe(PHOTO);
    expect(again.querySelector("pattern#graphy-node-bg")!.getAttribute("patternContentUnits")).toBe(
      "objectBoundingBox",
    );
  });
});
