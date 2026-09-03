const SVG_NS = "http://www.w3.org/2000/svg";
const PATTERN_ID = "graphy-node-bg";
const SHAPE_SELECTOR = "ellipse, polygon, circle, rect";
/** Point / null markers from Graphviz are tiny; skip them. */
const MIN_RADIUS = 4;
const MIN_EXTENT = 8;

/**
 * Injects an SVG pattern from `imageUrl` and paints visible node shapes with it.
 * Skips plaintext (no filled shapes), tiny point markers, and unfilled geometry.
 * Matrices (HTML-table plaintext nodes) are left alone.
 */
export function applyNodeBackgroundImage(svgRoot: Element, imageUrl: string): void {
  const doc = svgRoot.ownerDocument!;
  const defs = ensureDefs(svgRoot, doc);
  defs.querySelector(`#${PATTERN_ID}`)?.remove();
  defs.appendChild(buildPattern(doc, imageUrl));

  for (const node of svgRoot.querySelectorAll("g.node")) {
    for (const shape of node.querySelectorAll(SHAPE_SELECTOR)) {
      if (!isPaintableNodeShape(shape)) continue;
      shape.setAttribute("fill", `url(#${PATTERN_ID})`);
    }
  }
}

function ensureDefs(svgRoot: Element, doc: Document): Element {
  let defs = svgRoot.querySelector(":scope > defs");
  if (defs) return defs;
  defs = doc.createElementNS(SVG_NS, "defs");
  svgRoot.insertBefore(defs, svgRoot.firstChild);
  return defs;
}

function buildPattern(doc: Document, imageUrl: string): Element {
  const pattern = doc.createElementNS(SVG_NS, "pattern");
  pattern.setAttribute("id", PATTERN_ID);
  pattern.setAttribute("patternUnits", "objectBoundingBox");
  pattern.setAttribute("width", "1");
  pattern.setAttribute("height", "1");

  const image = doc.createElementNS(SVG_NS, "image");
  image.setAttribute("href", imageUrl);
  image.setAttribute("width", "1");
  image.setAttribute("height", "1");
  image.setAttribute("preserveAspectRatio", "xMidYMid slice");
  pattern.appendChild(image);

  // Soft scrim so labels stay readable on busy photos.
  const scrim = doc.createElementNS(SVG_NS, "rect");
  scrim.setAttribute("width", "1");
  scrim.setAttribute("height", "1");
  scrim.setAttribute("fill", "#000000");
  scrim.setAttribute("opacity", "0.22");
  pattern.appendChild(scrim);

  return pattern;
}

function isPaintableNodeShape(shape: Element): boolean {
  const fill = shape.getAttribute("fill");
  if (!fill || fill === "none") return false;

  const tag = shape.tagName.toLowerCase();
  if (tag === "ellipse" || tag === "circle") {
    const rx = parseFloat(shape.getAttribute("rx") ?? shape.getAttribute("r") ?? "0");
    const ry = parseFloat(shape.getAttribute("ry") ?? shape.getAttribute("r") ?? "0");
    return rx >= MIN_RADIUS && ry >= MIN_RADIUS;
  }

  if (tag === "rect") {
    const width = parseFloat(shape.getAttribute("width") ?? "0");
    const height = parseFloat(shape.getAttribute("height") ?? "0");
    return width >= MIN_EXTENT && height >= MIN_EXTENT;
  }

  if (tag === "polygon") {
    return polygonExtent(shape.getAttribute("points") ?? "") >= MIN_EXTENT;
  }

  return false;
}

/** Returns the larger axis span of a polygon's point list. */
function polygonExtent(points: string): number {
  const nums = points
    .trim()
    .split(/[\s,]+/)
    .map(Number)
    .filter((n) => Number.isFinite(n));
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const x = nums[i]!;
    const y = nums[i + 1]!;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return 0;
  return Math.max(maxX - minX, maxY - minY);
}
