export interface Point {
  x: number;
  y: number;
}

const MORPH_MS = 280;

/** Visible Graphy node positions from a Graphviz SVG root. */
export function nodePositions(svgRoot: Element): Map<string, Point> {
  const out = new Map<string, Point>();
  for (const node of svgRoot.querySelectorAll("g.node")) {
    const title = node.querySelector("title")?.textContent?.trim();
    if (!title || !/^n\d+$/i.test(title)) continue;
    const shape =
      node.querySelector("ellipse") ||
      node.querySelector("circle") ||
      node.querySelector("polygon") ||
      node.querySelector("rect");
    if (!shape) continue;
    const point = shapeCenter(shape);
    if (point) out.set(title.toLowerCase(), point);
  }
  return out;
}

function shapeCenter(shape: Element): Point | null {
  if (shape instanceof SVGEllipseElement || shape.tagName.toLowerCase() === "ellipse") {
    const cx = Number(shape.getAttribute("cx"));
    const cy = Number(shape.getAttribute("cy"));
    if (Number.isFinite(cx) && Number.isFinite(cy)) return { x: cx, y: cy };
  }
  if (shape instanceof SVGCircleElement || shape.tagName.toLowerCase() === "circle") {
    const cx = Number(shape.getAttribute("cx"));
    const cy = Number(shape.getAttribute("cy"));
    if (Number.isFinite(cx) && Number.isFinite(cy)) return { x: cx, y: cy };
  }
  if (shape instanceof SVGRectElement || shape.tagName.toLowerCase() === "rect") {
    const x = Number(shape.getAttribute("x"));
    const y = Number(shape.getAttribute("y"));
    const w = Number(shape.getAttribute("width"));
    const h = Number(shape.getAttribute("height"));
    if ([x, y, w, h].every(Number.isFinite)) return { x: x + w / 2, y: y + h / 2 };
  }
  // polygon / path fallback via bbox when available
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
  deletedIds: string[];
  durationMs?: number;
}

/**
 * FLIP-slides live nodes from `fromRoot` positions onto `toRoot`, fades new edges in,
 * and ghosts deleted nodes out. Resolves when the animation finishes.
 */
export function animateGraphMorph(options: MorphOptions): Promise<void> {
  const { fromRoot, toRoot, deletedIds, durationMs = MORPH_MS } = options;
  const from = nodePositions(fromRoot);
  const to = nodePositions(toRoot);

  for (const node of toRoot.querySelectorAll("g.node")) {
    const title = node.querySelector("title")?.textContent?.trim()?.toLowerCase();
    if (!title || !/^n\d+$/.test(title)) continue;
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

  const parent = toRoot;
  for (const id of deletedIds) {
    const source = [...fromRoot.querySelectorAll("g.node")].find(
      (n) => n.querySelector("title")?.textContent?.trim()?.toLowerCase() === id,
    );
    if (!source) continue;
    const ghost = source.cloneNode(true) as Element;
    ghost.setAttribute("data-graphy-state", "deleted");
    ghost.setAttribute("data-graphy-id", id);
    parent.appendChild(ghost);
  }

  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
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
        window.setTimeout(() => {
          for (const ghost of [...toRoot.querySelectorAll('[data-graphy-state="deleted"]')]) {
            ghost.remove();
          }
          for (const node of toRoot.querySelectorAll("g.node, g.edge")) {
            const el = node as SVGGElement;
            el.style.transition = "";
            el.style.transform = "";
            el.style.opacity = "";
          }
          resolve();
        }, durationMs + 20);
      });
    });
  });
}

export { MORPH_MS };
