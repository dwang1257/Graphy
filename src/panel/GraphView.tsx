import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import type { TraceFrame } from "../core/trace.js";
import { animateGraphMorph, createMorphGeneration } from "./graphMorph.js";
import { inkFromDataUrl } from "./imageInk.js";
import { applyNodeBackgroundImage } from "./nodeBackground.js";
import { applyTraceOverlay, clearTraceOverlay } from "./traceOverlay.js";
import { pointerDragHandler } from "./usePointerDrag.js";
import { normalizeWheelDelta, zoomAtPoint } from "./zoom.js";
import type { View } from "./zoom.js";
import "./trace.css";

interface Props {
  svg: string;
  fitKey: string;
  nodeBackgroundImage?: string | null;
  traceFrame?: TraceFrame | null;
  morphFromSvg?: string | null;
  morph?: boolean;
}

interface PreparedSvg {
  html: string;
  root: Element | null;
}

function prepareSvg(
  svg: string,
  nodeBackgroundImage: string | null | undefined,
  ink?: string,
): PreparedSvg {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (document.querySelector("parsererror")) return { html: "", root: null };

  for (const script of document.querySelectorAll("script")) script.remove();
  for (const element of document.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.toLowerCase().startsWith("on")) {
        element.removeAttribute(attribute.name);
      }
    }
  }

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

  return {
    html: new XMLSerializer().serializeToString(document.documentElement),
    root: document.documentElement,
  };
}

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
  const morphGeneration = useRef(createMorphGeneration());
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

  const preparedSvg = useMemo(
    () => prepareSvg(svg, nodeBackgroundImage, nodeInk),
    [svg, nodeBackgroundImage, nodeInk],
  );
  const sanitizedSvg = preparedSvg.html;

  const preparedFrom = useMemo(
    () =>
      morph && morphFromSvg
        ? prepareSvg(morphFromSvg, nodeBackgroundImage, nodeInk)
        : { html: "", root: null },
    [morph, morphFromSvg, nodeBackgroundImage, nodeInk],
  );
  const fromRoot = preparedFrom.root;

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
    const el = stage.current;
    const graph = viewport.current?.firstElementChild as SVGSVGElement | null;
    if (!el || !graph) return;
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const top = parseFloat(style.paddingTop) || 0;
    const bottom = parseFloat(style.paddingBottom) || 0;
    const boxHeight = box.height - top - bottom;
    if (box.width <= 24 || boxHeight <= 24) return;
    const width = graph.width.baseVal.value || graph.getBBox().width;
    const height = graph.height.baseVal.value || graph.getBBox().height;
    if (!width || !height) return;
    const scale = Math.min((box.width - 24) / width, (boxHeight - 24) / height, 1.6);
    setView({
      scale,
      x: (box.width - width * scale) / 2,
      y: top + (boxHeight - height * scale) / 2,
    });
  };

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
    const generation = morphGeneration.current.next();
    const root = viewport.current?.querySelector("svg");
    if (!root) return () => { morphGeneration.current.next(); };

    if (morph && fromRoot) {
      const frame = traceFrame;
      const handle = animateGraphMorph({ fromRoot, toRoot: root });
      void handle.done.finally(() => {
        if (!morphGeneration.current.isCurrent(generation)) return;
        const live = viewport.current?.querySelector("svg");
        if (!live) return;
        if (frame) applyTraceOverlay(live, frame);
        else clearTraceOverlay(live);
      });
      return () => {
        handle.cancel();
        morphGeneration.current.next();
      };
    }

    if (!traceFrame) {
      clearTraceOverlay(root);
      return () => {
        morphGeneration.current.next();
      };
    }
    applyTraceOverlay(root, traceFrame);

    return () => {
      morphGeneration.current.next();
    };
  }, [sanitizedSvg, fromRoot, morph, traceFrame]);

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
