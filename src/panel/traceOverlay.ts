import { isFilledText } from "../core/parse/matrix.js";
import type { TraceFrame } from "../core/trace.js";
import { IMAGE_TONE_ATTR, paintTone, type PaintTone } from "./imageInk.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const STATE_ATTR = "data-graphy-state";
const TONE_ATTR = "data-graphy-tone";
const ID_ATTR = "data-graphy-id";
const LABEL_ATTR = "data-graphy-label";
const ANCHOR_ATTR = "data-graphy-anchor";
const X_ATTR = "data-graphy-x";
const BASE_FILL_ATTR = "data-graphy-base-fill";
const FILL_ATTR = "data-graphy-fill";
const POINTER_CLASS = "graphy-pointer";
const NOTE_CLASS = "graphy-note";
const EDGE_TITLE = /^(.+?)(?:->|--)(.+)$/;
const BADGE_SLOTS = [-90, -45, -135, 0, 180, 45, 135, 90];
const NOTE_SLOTS = [0, 45, -45, 180, 135, -135, 90, -90];
const CLEAR_DEGREES = 40;
const GAP = 4;

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
  for (const text of svgRoot.querySelectorAll(`text[${X_ATTR}]`)) {
    text.setAttribute("x", text.getAttribute(X_ATTR) ?? "");
    text.setAttribute("text-anchor", text.getAttribute(ANCHOR_ATTR) ?? "start");
    text.removeAttribute(X_ATTR);
    text.removeAttribute(ANCHOR_ATTR);
  }
  for (const shape of svgRoot.querySelectorAll(`[${BASE_FILL_ATTR}]`)) {
    shape.setAttribute(FILL_ATTR, shape.getAttribute(BASE_FILL_ATTR) ?? "");
    shape.removeAttribute(BASE_FILL_ATTR);
  }
  for (const badge of svgRoot.querySelectorAll(`.${POINTER_CLASS}, .${NOTE_CLASS}`)) badge.remove();
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
  for (const [name, id] of Object.entries(frame.pointers)) {
    if (isCell(id)) add(id, "pointer");
    else pointers.set(id, [...(pointers.get(id) ?? []), name]);
  }

  const notes = frame.note === undefined ? undefined : frame.notes[frame.note];
  const ends = pointers.size > 0 || notes ? edgeEnds(svgRoot) : new Map<string, Point[]>();
  const tone = imageToneOf(svgRoot);
  for (const node of svgRoot.querySelectorAll("g.node")) {
    const id = node.querySelector("title")?.textContent?.trim();
    if (!id) continue;
    const states = targets.get(id);
    if (states) mark(node, id, states, tone);
    const label = frame.labels[id];
    if (label !== undefined) relabel(node, label);
    const names = pointers.get(id);
    const note = notes?.[id];
    if (!names && note === undefined) continue;
    const box = shapeBox(node);
    if (!box) continue;
    const angles = (ends.get(id) ?? []).map((point) => Math.atan2(point.y - box.cy, point.x - box.cx) * 180 / Math.PI);
    const taken: number[] = [];
    if (names) {
      const shown = names.length > MAX_POINTER_NAMES ? [...names.slice(0, MAX_POINTER_NAMES), "…"] : names;
      const slot = pickSlot(angles, BADGE_SLOTS);
      taken.push(slot);
      place(node, box, slot, POINTER_CLASS, shown.join(", "));
    }
    if (note !== undefined) place(node, box, pickSlot([...angles, ...taken], NOTE_SLOTS), NOTE_CLASS, note);
  }

  if (frame.current !== undefined && pointers.size > 1) {
    for (const edge of svgRoot.querySelectorAll("g.edge")) {
      const [, from, to] = EDGE_TITLE.exec(edge.querySelector("title")?.textContent?.trim() ?? "") ?? [];
      if (!from || !to || (from !== frame.current && to !== frame.current)) continue;
      if (pointers.has(from) && pointers.has(to)) edge.setAttribute(STATE_ATTR, "active");
    }
  }

  for (const anchor of svgRoot.querySelectorAll("a")) {
    const match = CELL_HREF.exec(hrefOf(anchor));
    if (!match) continue;
    const id = `${match[1]}${match[2]}.${match[3]}`;
    const label = frame.labels[id];
    if (label !== undefined) relabelCell(anchor, label);
    const states = targets.get(id);
    if (states) mark(anchor, id, states, tone);
  }
}

export function isCell(id: string): boolean {
  return id.includes(".");
}

function relabelCell(anchor: Element, label: string): void {
  const box = polygonBox(anchor.querySelector("polygon"));
  const text = anchor.querySelector("text");
  if (text && box) {
    text.setAttribute(LABEL_ATTR, text.textContent ?? "");
    text.setAttribute(X_ATTR, text.getAttribute("x") ?? "");
    text.setAttribute(ANCHOR_ATTR, text.getAttribute("text-anchor") ?? "start");
    text.setAttribute("x", String(box.cx));
    text.setAttribute("text-anchor", "middle");
    text.textContent = label;
  }
  const role = isFilledText(label) ? "cellFill" : "cellEmptyFill";
  for (const shape of anchor.querySelectorAll(`[${FILL_ATTR}^="cell"]`)) {
    const base = shape.getAttribute(FILL_ATTR);
    if (base !== "cellFill" && base !== "cellEmptyFill") continue;
    shape.setAttribute(BASE_FILL_ATTR, base);
    shape.setAttribute(FILL_ATTR, role);
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

interface Point {
  x: number;
  y: number;
}

interface ShapeBox {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

function edgeEnds(svgRoot: Element): Map<string, Point[]> {
  const ends = new Map<string, Point[]>();
  const push = (id: string, x: number | undefined, y: number | undefined): void => {
    if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) return;
    ends.set(id, [...(ends.get(id) ?? []), { x, y }]);
  };
  for (const edge of svgRoot.querySelectorAll("g.edge")) {
    const [, from, to] = EDGE_TITLE.exec(edge.querySelector("title")?.textContent?.trim() ?? "") ?? [];
    const nums = (edge.querySelector("path")?.getAttribute("d") ?? "").match(/-?\d*\.?\d+(?:e-?\d+)?/gi)?.map(Number) ?? [];
    if (!from || !to || nums.length < 4) continue;
    push(from, nums[0], nums[1]);
    push(to, nums[nums.length - 2], nums[nums.length - 1]);
  }
  return ends;
}

function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function pickSlot(angles: readonly number[], slots: readonly number[]): number {
  let best = slots[0]!;
  let bestGap = -1;
  for (const slot of slots) {
    const gap = Math.min(180, ...angles.map((angle) => angleGap(slot, angle)));
    if (gap >= CLEAR_DEGREES) return slot;
    if (gap > bestGap) {
      best = slot;
      bestGap = gap;
    }
  }
  return best;
}

function place(node: Element, box: ShapeBox, slot: number, className: string, value: string): void {
  const rad = slot * Math.PI / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const x = box.cx + (box.rx + GAP) * cos;
  const y = box.cy + (box.ry + GAP) * sin;
  const text = node.ownerDocument.createElementNS(SVG_NS, "text");
  text.setAttribute("class", className);
  text.setAttribute("x", String(round(x)));
  text.setAttribute("y", String(round(sin < -0.3 ? y : sin > 0.3 ? y + 9 : y + 4)));
  text.setAttribute("text-anchor", cos > 0.3 ? "start" : cos < -0.3 ? "end" : "middle");
  text.textContent = value;
  (node.parentElement ?? node).appendChild(text);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function shapeBox(node: Element): ShapeBox | null {
  const shape = node.querySelector("ellipse, circle, polygon");
  if (!shape) return null;
  const num = (name: string): number => Number(shape.getAttribute(name));
  if (shape.tagName.toLowerCase() === "polygon") return polygonBox(shape);
  const circle = shape.tagName.toLowerCase() === "circle";
  const box = { cx: num("cx"), cy: num("cy"), rx: circle ? num("r") : num("rx"), ry: circle ? num("r") : num("ry") };
  return Object.values(box).every(Number.isFinite) ? box : null;
}

function polygonBox(shape: Element | null): ShapeBox | null {
  const points = (shape?.getAttribute("points") ?? "")
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map(Number))
    .filter((pair): pair is [number, number] => pair.length === 2 && pair.every(Number.isFinite));
  if (points.length === 0) return null;
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const [left, right, top, bottom] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  return { cx: (left + right) / 2, cy: (top + bottom) / 2, rx: (right - left) / 2, ry: (bottom - top) / 2 };
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
