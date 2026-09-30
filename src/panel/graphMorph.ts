import { NODE_ID } from "../core/types.js";

export interface Point {
  x: number;
  y: number;
}

const MORPH_MS = 280;

export function createMorphGeneration(): { next: () => number; isCurrent: (generation: number) => boolean } {
  let current = 0;
  return {
    next: () => {
      current += 1;
      return current;
    },
    isCurrent: (generation) => generation === current,
  };
}

export function nodePositions(svgRoot: Element): Map<string, Point> {
  const out = new Map<string, Point>();
  for (const node of svgRoot.querySelectorAll("g.node")) {
    const title = node.querySelector("title")?.textContent?.trim();
    if (!title || !NODE_ID.test(title)) continue;
    const shape =
      node.querySelector("ellipse") ||
      node.querySelector("circle") ||
      node.querySelector("polygon") ||
      node.querySelector("rect");
    if (!shape) continue;
    const point = shapeCenter(shape);
    if (point) out.set(title, point);
  }
  return out;
}

function shapeCenter(shape: Element): Point | null {
  const tag = shape.tagName.toLowerCase();
  if (tag === "ellipse") {
    const cx = Number(shape.getAttribute("cx"));
    const cy = Number(shape.getAttribute("cy"));
    if (Number.isFinite(cx) && Number.isFinite(cy)) return { x: cx, y: cy };
  }
  if (tag === "circle") {
    const cx = Number(shape.getAttribute("cx"));
    const cy = Number(shape.getAttribute("cy"));
    if (Number.isFinite(cx) && Number.isFinite(cy)) return { x: cx, y: cy };
  }
  if (tag === "rect") {
    const x = Number(shape.getAttribute("x"));
    const y = Number(shape.getAttribute("y"));
    const w = Number(shape.getAttribute("width"));
    const h = Number(shape.getAttribute("height"));
    if ([x, y, w, h].every(Number.isFinite)) return { x: x + w / 2, y: y + h / 2 };
  }
  if ("getBBox" in shape && typeof (shape as SVGGraphicsElement).getBBox === "function") {
    try {
      const box = (shape as SVGGraphicsElement).getBBox();
      return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    } catch {
      return null;
    }
  }
  return null;
}

export interface MorphOptions {
  fromRoot: Element;
  toRoot: Element;
  durationMs?: number;
}

export interface MorphHandle {
  done: Promise<void>;
  cancel(): void;
}

function clearMorphStyles(toRoot: Element): void {
  for (const ghost of [...toRoot.querySelectorAll('[data-graphy-state="deleted"]')]) {
    ghost.remove();
  }
  for (const node of toRoot.querySelectorAll("g.node, g.edge")) {
    const el = node as SVGGElement;
    el.style.transition = "";
    el.style.transform = "";
    el.style.opacity = "";
  }
}

export function animateGraphMorph(options: MorphOptions): MorphHandle {
  const { fromRoot, toRoot, durationMs = MORPH_MS } = options;
  const from = nodePositions(fromRoot);
  const to = nodePositions(toRoot);
  let cancelled = false;
  let outerFrame = 0;
  let innerFrame = 0;
  let timer = 0;
  let settle: (() => void) | undefined;

  for (const node of toRoot.querySelectorAll("g.node")) {
    const title = node.querySelector("title")?.textContent?.trim();
    if (!title || !NODE_ID.test(title)) continue;
    const start = from.get(title);
    const end = to.get(title);
    if (!start || !end) continue;
    const dx = start.x - end.x;
    const dy = start.y - end.y;
    if (dx === 0 && dy === 0) continue;
    const el = node as SVGGElement;
    el.style.transition = "none";
    el.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  for (const edge of toRoot.querySelectorAll("g.edge")) {
    const el = edge as SVGGElement;
    el.style.transition = "none";
    el.style.opacity = "0";
  }

  const ghostParent = toRoot.querySelector("g.graph") ?? toRoot;
  for (const source of fromRoot.querySelectorAll("g.node")) {
    const id = source.querySelector("title")?.textContent?.trim();
    if (!id || !NODE_ID.test(id) || to.has(id)) continue;
    const ghost = source.cloneNode(true) as Element;
    ghost.setAttribute("data-graphy-state", "deleted");
    ghost.setAttribute("data-graphy-id", id);
    ghostParent.appendChild(ghost);
  }

  const done = new Promise<void>((resolve) => {
    settle = resolve;
    outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => {
        if (cancelled) {
          resolve();
          return;
        }
        for (const node of toRoot.querySelectorAll("g.node")) {
          const el = node as SVGGElement;
          el.style.transition = `transform ${durationMs}ms ease-in-out`;
          el.style.transform = "translate(0px, 0px)";
        }
        for (const edge of toRoot.querySelectorAll("g.edge")) {
          const el = edge as SVGGElement;
          el.style.transition = `opacity ${durationMs}ms ease-in-out`;
          el.style.opacity = "1";
        }
        for (const ghost of toRoot.querySelectorAll('[data-graphy-state="deleted"]')) {
          const el = ghost as SVGGElement;
          el.style.transition = `opacity ${durationMs}ms ease-in-out, transform ${durationMs}ms ease-in-out`;
          el.style.opacity = "0";
          el.style.transform = `${el.style.transform || ""} scale(0.85)`.trim();
        }
        timer = window.setTimeout(() => {
          if (!cancelled) clearMorphStyles(toRoot);
          resolve();
        }, durationMs + 20);
      });
    });
  });

  return {
    done,
    cancel() {
      if (cancelled) return;
      cancelled = true;
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
      window.clearTimeout(timer);
      clearMorphStyles(toRoot);
      settle?.();
    },
  };
}

export { MORPH_MS };
