import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import { pointerDragHandler } from "./usePointerDrag.js";
import { normalizeWheelDelta, zoomAtPoint } from "./zoom.js";
import type { View } from "./zoom.js";

interface Props {
  svg: string;
  /** Changing this resets the view - a new pane should start fitted. */
  fitKey: string;
}

function sanitizeSvg(svg: string): string {
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

  return new XMLSerializer().serializeToString(document.documentElement);
}

/** Zoom/pan surface for the rendered SVG. */
export function GraphView({ svg, fitKey }: Props): JSX.Element {
  const stage = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const view = useRef<View>({ x: 0, y: 0, scale: 1 });
  const paintFrame = useRef<number | null>(null);
  const [panning, setPanning] = useState(false);
  const sanitizedSvg = useMemo(() => sanitizeSvg(svg), [svg]);

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
    if (!box || !graph) return;
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

  useLayoutEffect(fit, [fitKey, svg]);

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
