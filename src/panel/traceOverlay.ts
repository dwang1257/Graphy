import type { TraceFrame } from "../core/trace.js";
import { IMAGE_TONE_ATTR, paintTone, type PaintTone } from "./imageInk.js";

const STATE_ATTR = "data-graphy-state";
const TONE_ATTR = "data-graphy-tone";
const ID_ATTR = "data-graphy-id";
const CELL_HREF = /^graphy:\/\/cell\/(\d+)\/(\d+)$/;
const SHAPE_SELECTOR = "ellipse, polygon, circle, rect, path";

/** Clears prior highlight attributes from the rendered SVG. */
export function clearTraceOverlay(svgRoot: Element): void {
  for (const el of svgRoot.querySelectorAll(`[${STATE_ATTR}]`)) {
    el.removeAttribute(STATE_ATTR);
  }
  for (const el of svgRoot.querySelectorAll(`[${ID_ATTR}]`)) {
    el.removeAttribute(ID_ATTR);
  }
  for (const el of svgRoot.querySelectorAll(`[${TONE_ATTR}]`)) {
    el.removeAttribute(TONE_ATTR);
  }
}

/**
 * Paints current / visited / frontier onto Graphviz node groups and matrix cell links.
 * Prefer this over re-running layout — ids stay stable across frames.
 */
export function applyTraceOverlay(svgRoot: Element, frame: TraceFrame): void {
  clearTraceOverlay(svgRoot);

  const targets = new Map<string, Set<string>>();
  const add = (id: string | undefined, state: string): void => {
    if (!id) return;
    const bag = targets.get(id) ?? new Set<string>();
    bag.add(state);
    targets.set(id, bag);
  };

  for (const id of frame.visited) add(id, "visited");
  for (const id of frame.frontier) add(id, "frontier");
  add(frame.current, "current");

  if (targets.size === 0) return;

  indexNodes(svgRoot, targets);
  indexCells(svgRoot, targets);
}

function indexNodes(svgRoot: Element, targets: Map<string, Set<string>>): void {
  for (const node of svgRoot.querySelectorAll("g.node")) {
    const title = node.querySelector("title")?.textContent?.trim();
    if (!title) continue;
    const states = targets.get(title);
    if (!states) continue;
    node.setAttribute(ID_ATTR, title);
    node.setAttribute(STATE_ATTR, [...states].join(" "));
    markTone(node, imageToneOf(svgRoot));
  }
}

function indexCells(svgRoot: Element, targets: Map<string, Set<string>>): void {
  for (const anchor of svgRoot.querySelectorAll("a")) {
    const href =
      anchor.getAttribute("data-graphy-href") ||
      anchor.getAttribute("href") ||
      anchor.getAttribute("xlink:href") ||
      anchor.getAttributeNS("http://www.w3.org/1999/xlink", "href") ||
      "";
    const match = CELL_HREF.exec(href);
    if (!match) continue;
    const id = `cell:${match[1]},${match[2]}`;
    const states = targets.get(id);
    if (!states) continue;
    anchor.setAttribute(ID_ATTR, id);
    anchor.setAttribute(STATE_ATTR, [...states].join(" "));
    markTone(anchor, imageToneOf(svgRoot));
  }
}

function imageToneOf(svgRoot: Element): PaintTone | null {
  const tone = svgRoot.getAttribute(IMAGE_TONE_ATTR);
  return tone === "light" || tone === "dark" ? tone : null;
}

function markTone(target: Element, imageTone: PaintTone | null): void {
  target.setAttribute(TONE_ATTR, paintTone(paintFill(target), imageTone));
}

function paintFill(target: Element): string | null {
  if (target.matches(SHAPE_SELECTOR)) return readFill(target);
  const shape = target.querySelector(SHAPE_SELECTOR);
  return shape ? readFill(shape) : null;
}

function readFill(el: Element): string | null {
  const attr = el.getAttribute("fill");
  if (attr) return attr;
  const style = el.getAttribute("style");
  if (!style) return null;
  return /(?:^|;)\s*fill\s*:\s*([^;]+)/i.exec(style)?.[1]?.trim() ?? null;
}
