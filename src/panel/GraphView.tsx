import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import type { TraceFrame } from "../core/trace.js";
import { animateGraphMorph } from "./graphMorph.js";
import { inkFromDataUrl } from "./imageInk.js";
import { applyNodeBackgroundImage } from "./nodeBackground.js";
import { applyTraceOverlay, clearTraceOverlay } from "./traceOverlay.js";
import { pointerDragHandler } from "./usePointerDrag.js";
import { normalizeWheelDelta, zoomAtPoint } from "./zoom.js";
import type { View } from "./zoom.js";

interface Props {
  svg: string;
  /** Changing this resets the view - a new pane should start fitted. */
  fitKey: string;
  /** Data URL painted onto node shapes after Graphviz layout, or null. */
  nodeBackgroundImage?: string | null;
  /** Current playback frame to highlight, or null to clear. */
  traceFrame?: TraceFrame | null;
  /** Previous topology SVG for FLIP morph (sequential steps only). */
  morphFromSvg?: string | null;
  /** When true, animate from morphFromSvg into svg. */
  morph?: boolean;
}

function prepareSvg(
  svg: string,
  nodeBackgroundImage: string | null | undefined,
  ink?: string,
): string {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (document.querySelector("parsererror")) return "";

  for (const script of document.querySelectorAll("script")) script.remove();
  for (const element of document.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.toLowerCase().startsWith("on")) {
        element.removeAttribute(attribute.name);
      }
    }
  }

  // Keep cell addresses for overlays; drop live hrefs so clicks cannot navigate.
  for (const anchor of document.querySelectorAll("a")) {
    const href =
      anchor.getAttribute("href") ||
      anchor.getAttribute("xlink:href") ||
      anchor.getAttributeNS("http://www.w3.org/1999/xlink", "href");
    if (href && href.startsWith("graphy://")) {
      anchor.setAttribute("data-graphy-href", href);
      anchor.removeAttribute("href");
      anchor.removeAttribute("xlink:href");
      anchor.removeAttributeNS("http://www.w3.org/1999/xlink", "href");
    }
  }

  if (nodeBackgroundImage) {
    applyNodeBackgroundImage(document.documentElement, nodeBackgroundImage, ink);
  }

  return new XMLSerializer().serializeToString(document.documentElement);
}

/** Zoom/pan surface for the rendered SVG. */
export function GraphView({
  svg,
  fitKey,
  nodeBackgroundImage = null,
  traceFrame = null,
  morphFromSvg = null,
  morph = false,
}: Props): JSX.Element {
  const stage = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ x: 0, y: 0, scale: 1 });
  const paintFrame = useRef<number | null>(null);
  const morphing = useRef(false);
  const [panning, setPanning] = useState(false);
  const [nodeInk, setNodeInk] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!nodeBackgroundImage) {
      setNodeInk(undefined);
      return;
    }
    setNodeInk(undefined);
    let cancelled = false;
    void inkFromDataUrl(nodeBackgroundImage)
      .then((ink) => {
        if (!cancelled) setNodeInk(ink);
      })
      .catch(() => {
        if (!cancelled) setNodeInk(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [nodeBackgroundImage]);

  const sanitizedSvg = useMemo(
    () => prepareSvg(svg, nodeBackgroundImage, nodeInk),
    [svg, nodeBackgroundImage, nodeInk],
  );

  const sanitizedFrom = useMemo(
    () =>
      morph && morphFromSvg
        ? prepareSvg(morphFromSvg, nodeBackgroundImage, nodeInk)
        : "",
    [morph, morphFromSvg, nodeBackgroundImage, nodeInk],
  );

  const paintView = (): void => {
    const { x, y, scale } = view.current;
    if (viewport.current) {
      viewport.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }
  };

  const setView = (next: View, deferPaint = false): void => {
    view.current = next;
    if (!deferPaint) {
      paintView();
      return;
    }
    if (paintFrame.current !== null) return;
    paintFrame.current = requestAnimationFrame(() => {
      paintFrame.current = null;
      paintView();
    });
  };

  const fit = (): void => {
    const box = stage.current?.getBoundingClientRect();
    const graph = viewport.current?.firstElementChild as SVGSVGElement | null;
    if (!box || !graph || box.width <= 24 || box.height <= 24) return;
    const width = graph.width.baseVal.value || graph.getBBox().width;
    const height = graph.height.baseVal.value || graph.getBBox().height;
    if (!width || !height) return;
    const scale = Math.min((box.width - 24) / width, (box.height - 24) / height, 1.6);
    setView({
      scale,
      x: (box.width - width * scale) / 2,
      y: (box.height - height * scale) / 2,
    });
  };

  // Fit when the case/pane/user-fit key changes, and once when SVG first arrives for that key.
  const fittedFor = useRef("");
  useLayoutEffect(() => {
    if (!sanitizedSvg) return;
    if (fittedFor.current !== fitKey) {
      fittedFor.current = fitKey;
      fit();
    }
  }, [fitKey, sanitizedSvg]);

  useEffect(() => {
    const el = stage.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => fit());
    observer.observe(el);
    return () => observer.disconnect();
  }, [fitKey]);

  useLayoutEffect(() => {
    const root = viewport.current?.querySelector("svg");
    if (!root) return;

    if (morphing.current) return;

    if (morph && sanitizedFrom) {
      const fromDoc = new DOMParser().parseFromString(sanitizedFrom, "image/svg+xml");
      const fromRoot = fromDoc.documentElement;
      if (!fromDoc.querySelector("parsererror")) {
        morphing.current = true;
        const frame = traceFrame;
        void animateGraphMorph({
          fromRoot,
          toRoot: root,
          deletedIds: frame?.deleted ?? [],
        }).finally(() => {
          morphing.current = false;
          const live = viewport.current?.querySelector("svg");
          if (!live) return;
          if (frame) applyTraceOverlay(live, frame);
          else clearTraceOverlay(live);
        });
        return;
      }
    }

    if (!traceFrame) {
      clearTraceOverlay(root);
      return;
    }
    applyTraceOverlay(root, traceFrame);
  }, [sanitizedSvg, sanitizedFrom, morph, traceFrame]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      const box = el.getBoundingClientRect();
      const px = event.clientX - box.left;
      const py = event.clientY - box.top;
      const delta = normalizeWheelDelta(event.deltaY, event.deltaMode, box.height);
      setView(zoomAtPoint(view.current, { x: px, y: py }, delta), true);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      if (paintFrame.current !== null) {
        cancelAnimationFrame(paintFrame.current);
        paintFrame.current = null;
      }
    };
  }, []);

  const onPointerDown = pointerDragHandler<HTMLDivElement>({
    coords: "client",
    onStart: () => setPanning(true),
    onMove: (dx, dy) =>
      setView({ ...view.current, x: view.current.x + dx, y: view.current.y + dy }),
    onEnd: () => setPanning(false),
  });

  return (
    <div class="stage" ref={stage}>
      <div class={`canvas${panning ? " panning" : ""}`} onPointerDown={onPointerDown}>
        <div
          class="viewport"
          ref={viewport}
          style={{
            transform: `translate(${view.current.x}px, ${view.current.y}px) scale(${view.current.scale})`,
          }}
          dangerouslySetInnerHTML={{ __html: sanitizedSvg }}
        />
      </div>
    </div>
  );
}
