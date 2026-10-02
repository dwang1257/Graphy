import { isPaintRole, roleOfPlaceholder, type PaintColors } from "../core/dot/paintRoles.js";
import type { Palette } from "../settings/schema.js";
import { contrastInkFromCss } from "./imageInk.js";
import { applyNodeBackgroundImage, clearNodeBackgroundImage } from "./nodeBackground.js";

export interface NodeImagePaint {
  url: string;
  ink: string | undefined;
}

export interface SvgPaint {
  colors: PaintColors;
  nodeImage: NodeImagePaint | null;
}

const PAINT_ATTRS = ["fill", "stroke"] as const;
const SAFE_COLOR = /^(?:#[0-9a-f]{3,8}|[a-z]+|(?:rgb|hsl|oklch|oklab|lab|lch|hwb)a?\([0-9a-z\s.,%/+-]*\))$/i;
const FALLBACK_COLOR = "#000000";

function safeColor(value: string): string {
  const color = value.trim();
  return SAFE_COLOR.test(color) ? color : FALLBACK_COLOR;
}

export function paintColors(palette: Palette): PaintColors {
  return {
    nodeFill: safeColor(palette.nodeFill),
    nodeStroke: safeColor(palette.nodeStroke),
    nodeInk: contrastInkFromCss(palette.nodeFill),
    rootFill: safeColor(palette.rootFill),
    rootStroke: safeColor(palette.rootStroke),
    rootInk: contrastInkFromCss(palette.rootFill),
    terminal: safeColor(palette.terminalText),
    edge: safeColor(palette.edgeColor),
    edgeText: safeColor(palette.edgeText),
    cycle: safeColor(palette.cycleColor),
    cellFill: safeColor(palette.cellFill),
    cellEmptyFill: safeColor(palette.cellEmptyFill),
    cellStroke: safeColor(palette.cellStroke),
    cellText: safeColor(palette.cellText),
    gutterText: safeColor(palette.gutterText),
  };
}

export function svgPaint(palette: Palette, nodeImageUrl: string | null, nodeInk: string | undefined): SvgPaint {
  return {
    colors: paintColors(palette),
    nodeImage: nodeImageUrl ? { url: nodeImageUrl, ink: nodeInk } : null,
  };
}

export function tagPaintRoles(element: Element): void {
  for (const attr of PAINT_ATTRS) {
    const role = roleOfPlaceholder(element.getAttribute(attr));
    if (role) element.setAttribute(`data-graphy-${attr}`, role);
  }
}

export function paintSvg(svgRoot: Element, paint: SvgPaint): void {
  for (const attr of PAINT_ATTRS) {
    const marker = `data-graphy-${attr}`;
    for (const element of svgRoot.querySelectorAll(`[${marker}]`)) {
      const role = element.getAttribute(marker);
      if (!isPaintRole(role)) continue;
      const color = paint.colors[role];
      if (element.getAttribute(attr) !== color) element.setAttribute(attr, color);
    }
  }
  if (paint.nodeImage) applyNodeBackgroundImage(svgRoot, paint.nodeImage.url, paint.nodeImage.ink);
  else clearNodeBackgroundImage(svgRoot);
}
