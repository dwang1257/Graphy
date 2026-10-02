import type { TraceFrame } from "../core/trace.js";
import { IMAGE_TONE_ATTR, paintTone, type PaintTone } from "./imageInk.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const STATE_ATTR = "data-graphy-state";
const TONE_ATTR = "data-graphy-tone";
const ID_ATTR = "data-graphy-id";
const LABEL_ATTR = "data-graphy-label";
const POINTER_CLASS = "graphy-pointer";
const CELL_HREF = /^graphy:\/\/cell\/([a-y])\/(\d+)\/(\d+)$/;
const SHAPE_SELECTOR = "ellipse, polygon, circle, rect, path";
const MAX_POINTER_NAMES = 3;

export function clearTraceOverlay(svgRoot: Element): void {
  for (const attr of [STATE_ATTR, ID_ATTR, TONE_ATTR]) {
    for (const el of svgRoot.querySelectorAll(`[${attr}]`)) el.removeAttribute(attr);
  }
  for (const text of svgRoot.querySelectorAll(`text[${LABEL_ATTR}]`)) {
    text.textContent = text.getAttribute(LABEL_ATTR);
    text.removeAttribute(LABEL_ATTR);
  }
  for (const badge of svgRoot.querySelectorAll(`.${POINTER_CLASS}`)) badge.remove();
}

export function refreshTraceTones(svgRoot: Element): void {
  const tone = imageToneOf(svgRoot);
  for (const target of svgRoot.querySelectorAll(`[${TONE_ATTR}]`)) {
    const next = paintTone(paintFill(target), tone);
    if (target.getAttribute(TONE_ATTR) !== next) target.setAttribute(TONE_ATTR, next);
  }
}

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
  for (const id of frame.dimmed) add(id, "dimmed");
  add(frame.current, "current");

  const pointers = new Map<string, string[]>();
  for (const [name, id] of Object.entries(frame.pointers)) pointers.set(id, [...(pointers.get(id) ?? []), name]);

  const tone = imageToneOf(svgRoot);
  for (const node of svgRoot.querySelectorAll("g.node")) {
    const id = node.querySelector("title")?.textContent?.trim();
    if (!id) continue;
    const states = targets.get(id);
    if (states) mark(node, id, states, tone);
    const label = frame.labels[id];
    if (label !== undefined) relabel(node, label);
    const names = pointers.get(id);
    if (names) badge(node, names);
  }

  for (const anchor of svgRoot.querySelectorAll("a")) {
    const match = CELL_HREF.exec(hrefOf(anchor));
    if (!match) continue;
    const id = `${match[1]}${match[2]}.${match[3]}`;
    const states = targets.get(id);
    if (states) mark(anchor, id, states, tone);
  }
}

function hrefOf(anchor: Element): string {
  return anchor.getAttribute("data-graphy-href")
    || anchor.getAttribute("href")
    || anchor.getAttribute("xlink:href")
    || anchor.getAttributeNS("http://www.w3.org/1999/xlink", "href")
    || "";
}

function mark(target: Element, id: string, states: Set<string>, tone: PaintTone | null): void {
  target.setAttribute(ID_ATTR, id);
  target.setAttribute(STATE_ATTR, [...states].join(" "));
  target.setAttribute(TONE_ATTR, paintTone(paintFill(target), tone));
}

function relabel(node: Element, label: string): void {
  const text = node.querySelector("text");
  if (!text) return;
  text.setAttribute(LABEL_ATTR, text.textContent ?? "");
  text.textContent = label;
}

function badge(node: Element, names: string[]): void {
  const box = shapeBox(node);
  if (!box) return;
  const shown = names.length > MAX_POINTER_NAMES ? [...names.slice(0, MAX_POINTER_NAMES), "…"] : names;
  const text = node.ownerDocument.createElementNS(SVG_NS, "text");
  text.setAttribute("class", POINTER_CLASS);
  text.setAttribute("x", String(box.x));
  text.setAttribute("y", String(box.top - 4));
  text.setAttribute("text-anchor", "middle");
  text.textContent = shown.join(", ");
  (node.parentElement ?? node).appendChild(text);
}

function shapeBox(node: Element): { x: number; top: number } | null {
  const shape = node.querySelector("ellipse, circle, polygon");
  if (!shape) return null;
  const num = (name: string): number => Number(shape.getAttribute(name));
  if (shape.tagName.toLowerCase() === "polygon") {
    const points = (shape.getAttribute("points") ?? "")
      .trim()
      .split(/\s+/)
      .map((pair) => pair.split(",").map(Number))
      .filter((pair): pair is [number, number] => pair.length === 2 && pair.every(Number.isFinite));
    if (points.length === 0) return null;
    const xs = points.map(([x]) => x);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, top: Math.min(...points.map(([, y]) => y)) };
  }
  const radius = shape.tagName.toLowerCase() === "circle" ? num("r") : num("ry");
  const box = { x: num("cx"), top: num("cy") - radius };
  return Number.isFinite(box.x) && Number.isFinite(box.top) ? box : null;
}

function imageToneOf(svgRoot: Element): PaintTone | null {
  const tone = svgRoot.getAttribute(IMAGE_TONE_ATTR);
  return tone === "light" || tone === "dark" ? tone : null;
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
