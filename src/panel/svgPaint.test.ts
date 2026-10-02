import { Window } from "happy-dom";
import { describe, expect, it } from "vitest";

import { PLACEHOLDER } from "../core/dot/paintRoles.js";
import { DEFAULT_SETTINGS } from "../settings/schema.js";
import { DARK_INK, LIGHT_INK, contrastInkFromCss } from "./imageInk.js";
import { paintColors, paintSvg, svgPaint, tagPaintRoles } from "./svgPaint.js";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg"><g class="graph">
<polygon fill="transparent" stroke="none" points="0,0 1,1"/>
<g class="node"><title>a0</title><ellipse rx="20" ry="20" fill="${PLACEHOLDER.rootFill}" stroke="${PLACEHOLDER.rootStroke}"/><text fill="${PLACEHOLDER.rootInk}">1</text></g>
<g class="node"><title>a1</title><ellipse rx="20" ry="20" fill="${PLACEHOLDER.nodeFill}" stroke="${PLACEHOLDER.nodeStroke}"/><text fill="${PLACEHOLDER.nodeInk}">2</text></g>
<g class="edge"><path fill="none" stroke="${PLACEHOLDER.edge}"/><polygon fill="${PLACEHOLDER.edge}" stroke="${PLACEHOLDER.edge}" points="0,0 1,1"/></g>
</g></svg>`;

function svgRoot(): Element {
  const window = new Window();
  const root = new window.DOMParser().parseFromString(SVG, "image/svg+xml").documentElement as unknown as Element;
  for (const element of root.querySelectorAll("*")) tagPaintRoles(element);
  return root;
}

function shape(root: Element, id: string): Element {
  const node = [...root.querySelectorAll("g.node")].find((el) => el.querySelector("title")?.textContent === id)!;
  return node.querySelector("ellipse")!;
}

describe("svgPaint", () => {
  it("tags only placeholder colors with their paint role", () => {
    const root = svgRoot();
    expect(shape(root, "a1").getAttribute("data-graphy-fill")).toBe("nodeFill");
    expect(shape(root, "a1").getAttribute("data-graphy-stroke")).toBe("nodeStroke");
    expect(root.querySelector("g.graph > polygon")?.hasAttribute("data-graphy-fill")).toBe(false);
    expect(root.querySelector("g.edge path")?.hasAttribute("data-graphy-fill")).toBe(false);
  });

  it("maps roles to real palette colors with contrast ink and repaints in place", () => {
    const root = svgRoot();
    const ellipse = shape(root, "a1");
    paintSvg(root, svgPaint(DEFAULT_SETTINGS.light, null, undefined));
    expect(ellipse.getAttribute("fill")).toBe(DEFAULT_SETTINGS.light.nodeFill);
    expect(ellipse.getAttribute("stroke")).toBe(DEFAULT_SETTINGS.light.nodeStroke);
    expect(root.querySelector("g.edge polygon")?.getAttribute("fill")).toBe(DEFAULT_SETTINGS.light.edgeColor);
    expect(ellipse.parentElement?.querySelector("text")?.getAttribute("fill")).toBe(contrastInkFromCss(DEFAULT_SETTINGS.light.nodeFill));

    paintSvg(root, svgPaint({ ...DEFAULT_SETTINGS.light, nodeFill: "#000000", rootFill: "#ffffff" }, null, undefined));
    expect(shape(root, "a1")).toBe(ellipse);
    expect(ellipse.getAttribute("fill")).toBe("#000000");
    expect(ellipse.parentElement?.querySelector("text")?.getAttribute("fill")).toBe(LIGHT_INK);
    expect(shape(root, "a0").parentElement?.querySelector("text")?.getAttribute("fill")).toBe(DARK_INK);
  });

  it("applies and removes a node image pattern on top of the palette", () => {
    const root = svgRoot();
    paintSvg(root, svgPaint(DEFAULT_SETTINGS.dark, "blob:node", LIGHT_INK));
    expect(shape(root, "a1").getAttribute("fill")).toBe("url(#graphy-node-bg)");
    expect(root.querySelector("#graphy-node-bg image")?.getAttribute("href")).toBe("blob:node");
    expect(root.getAttribute("data-graphy-image-tone")).toBe("dark");
    const pattern = root.querySelector("#graphy-node-bg");
    paintSvg(root, svgPaint({ ...DEFAULT_SETTINGS.dark, edgeColor: "#123456" }, "blob:node", LIGHT_INK));
    expect(root.querySelector("#graphy-node-bg")).toBe(pattern);

    paintSvg(root, svgPaint(DEFAULT_SETTINGS.dark, null, undefined));
    expect(root.querySelector("#graphy-node-bg")).toBeNull();
    expect(root.hasAttribute("data-graphy-image-tone")).toBe(false);
    expect(shape(root, "a1").getAttribute("fill")).toBe(DEFAULT_SETTINGS.dark.nodeFill);
    expect(shape(root, "a1").parentElement?.querySelector("text")?.getAttribute("fill")).toBe(contrastInkFromCss(DEFAULT_SETTINGS.dark.nodeFill));
  });

  it("refuses paint values that could reference other resources", () => {
    const colors = paintColors({ ...DEFAULT_SETTINGS.light, nodeFill: "url(https://example.com/x.svg#a)", edgeColor: "rgb(1, 2, 3)" });
    expect(colors.nodeFill).toBe("#000000");
    expect(colors.edge).toBe("rgb(1, 2, 3)");
  });
});
