import { useEffect, useLayoutEffect, useMemo, useRef } from "preact/hooks";
import type { JSX } from "preact";
import type { TraceFrame } from "../core/trace.js";
import { animateGraphMorph, createMorphGeneration } from "./graphMorph.js";
import { memo } from "./memo.js";
import { paintSvg, tagPaintRoles, type SvgPaint } from "./svgPaint.js";
import { applyTraceOverlay, clearTraceOverlay, refreshTraceTones } from "./traceOverlay.js";
import { pointerDragHandler } from "./usePointerDrag.js";
import { normalizeWheelDelta, zoomAtPoint } from "./zoom.js";
import type { View } from "./zoom.js";
import "./trace.css";

export const GESTURE_IDLE_MS = 150;
export const GESTURE_CLASS = "is-gesturing";

interface Props {
  svg: string;
  fitKey: string;
  paint: SvgPaint;
  traceFrame?: TraceFrame | null;
  morphFromSvg?: string | null;
}

const XLINK_NS = "http://www.w3.org/1999/xlink";

function prepareSvg(svg: string): Element | null {
  const document = new DOMParser().parseFromString(svg, "image/svg+xml");
  if (document.querySelector("parsererror")) return null;

  for (const script of document.querySelectorAll("script")) script.remove();
  for (const element of document.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      if (attribute.name.toLowerCase().startsWith("on")) {
        element.removeAttribute(attribute.name);
      }
    }
    tagPaintRoles(element);
  }

  for (const anchor of document.querySelectorAll("a")) {
    const href =
      anchor.getAttribute("href") ||
      anchor.getAttribute("xlink:href") ||
      anchor.getAttributeNS(XLINK_NS, "href");
    if (href && href.startsWith("graphy://")) {
      anchor.setAttribute("data-graphy-href", href);
      anchor.removeAttribute("href");
      anchor.removeAttribute("xlink:href");
      anchor.removeAttributeNS(XLINK_NS, "href");
    }
  }

  return document.documentElement;
}

function viewTransform({ x, y, scale }: View): string {
  return `translate(${x}px, ${y}px) scale(${scale})`;
}

function GraphViewImpl({ svg, fitKey, paint, traceFrame = null, morphFromSvg = null }: Props): JSX.Element {
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ x: 0, y: 0, scale: 1 });
  const paintFrame = useRef<number | null>(null);
  const resizeFrame = useRef<number | null>(null);
  const gestureTimer = useRef<number | undefined>(undefined);
  const userMoved = useRef(false);
  const morphGeneration = useRef(createMorphGeneration());
  const latestPaint = useRef(paint);
  latestPaint.current = paint;

  const prepared = useMemo(() => prepareSvg(svg), [svg]);
  const fromRoot = useMemo(
    () => (morphFromSvg ? prepareSvg(morphFromSvg) : null),
    [morphFromSvg],
  );

  useLayoutEffect(() => {
    const el = viewport.current;
    if (!el) return;
    if (!prepared) {
      el.replaceChildren();
      return;
    }
    el.replaceChildren(el.ownerDocument.adoptNode(prepared));
  }, [prepared]);

  const liveSvg = (): Element | null => viewport.current?.querySelector("svg") ?? null;

  const paintView = (): void => {
    if (viewport.current) viewport.current.style.transform = viewTransform(view.current);
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

  const markGesture = (): void => {
    userMoved.current = true;
    const el = viewport.current;
    if (!el) return;
    el.classList.add(GESTURE_CLASS);
    window.clearTimeout(gestureTimer.current);
    gestureTimer.current = window.setTimeout(() => el.classList.remove(GESTURE_CLASS), GESTURE_IDLE_MS);
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
    userMoved.current = false;
    setView({
      scale,
      x: (box.width - width * scale) / 2,
      y: top + (boxHeight - height * scale) / 2,
    });
  };
  const fitRef = useRef(fit);
  fitRef.current = fit;

  const fittedFor = useRef("");
  useLayoutEffect(() => {
    if (!prepared) return;
    if (fittedFor.current !== fitKey) {
      fittedFor.current = fitKey;
      fit();
    }
  }, [fitKey, prepared]);

  useEffect(() => {
    const el = stage.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (userMoved.current || resizeFrame.current !== null) return;
      resizeFrame.current = requestAnimationFrame(() => {
        resizeFrame.current = null;
        if (!userMoved.current) fitRef.current();
      });
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (resizeFrame.current !== null) {
        cancelAnimationFrame(resizeFrame.current);
        resizeFrame.current = null;
      }
    };
  }, []);

  useLayoutEffect(() => {
    const root = liveSvg();
    if (!root) return;
    paintSvg(root, paint);
    refreshTraceTones(root);
  }, [prepared, paint]);

  useLayoutEffect(() => {
    const generation = morphGeneration.current.next();
    const root = liveSvg();
    if (!root) return () => { morphGeneration.current.next(); };

    if (fromRoot) {
      const frame = traceFrame;
      paintSvg(fromRoot, latestPaint.current);
      const handle = animateGraphMorph({ fromRoot, toRoot: root });
      void handle.done.finally(() => {
        if (!morphGeneration.current.isCurrent(generation)) return;
        const live = liveSvg();
        if (!live) return;
        if (frame) applyTraceOverlay(live, frame);
        else clearTraceOverlay(live);
      });
      return () => {
        handle.cancel();
        morphGeneration.current.next();
      };
    }

    if (traceFrame) applyTraceOverlay(root, traceFrame);
    else clearTraceOverlay(root);
    return () => {
      morphGeneration.current.next();
    };
  }, [prepared, fromRoot, traceFrame]);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault();
      markGesture();
      const box = el.getBoundingClientRect();
      const px = event.clientX - box.left;
      const py = event.clientY - box.top;
      const delta = normalizeWheelDelta(event.deltaY, event.deltaMode, box.height);
      setView(zoomAtPoint(view.current, { x: px, y: py }, delta), true);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.clearTimeout(gestureTimer.current);
      if (paintFrame.current !== null) {
        cancelAnimationFrame(paintFrame.current);
        paintFrame.current = null;
      }
    };
  }, []);

  const onPointerDown = useMemo(() => pointerDragHandler<HTMLDivElement>({
    coords: "client",
    onStart: () => canvas.current?.classList.add("panning"),
    onMove: (dx, dy) => {
      markGesture();
      setView({ ...view.current, x: view.current.x + dx, y: view.current.y + dy }, true);
    },
    onEnd: () => canvas.current?.classList.remove("panning"),
  }), []);

  return (
    <div class="stage" ref={stage}>
      <div class="canvas" ref={canvas} onPointerDown={onPointerDown}>
        <div class="viewport" ref={viewport} />
      </div>
    </div>
  );
}

export const GraphView = memo(GraphViewImpl);
