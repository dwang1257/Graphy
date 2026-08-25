import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import type { JSX } from "preact";
import { pointerDragHandler } from "./usePointerDrag.js";

interface Props {
  svg: string;
  /** Changing this resets the view - a new pane should start fitted. */
  fitKey: string;
}

interface View {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.15;
const MAX_SCALE = 6;

/** Zoom/pan surface for the rendered SVG. */
export function GraphView({ svg, fitKey }: Props): JSX.Element {
  const stage = useRef<HTMLDivElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState(false);

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
      setView((prev) => {
        const factor = Math.exp(-event.deltaY * 0.0015);
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * factor));
        const ratio = scale / prev.scale;
        // Keep the point under the cursor fixed while zooming.
        return { scale, x: px - (px - prev.x) * ratio, y: py - (py - prev.y) * ratio };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onPointerDown = pointerDragHandler<HTMLDivElement>({
    coords: "client",
    onStart: () => setPanning(true),
    onMove: (dx, dy) => setView((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy })),
    onEnd: () => setPanning(false),
  });

  return (
    <div class="stage" ref={stage}>
      <div class={`canvas${panning ? " panning" : ""}`} onPointerDown={onPointerDown}>
        <div
          class="viewport"
          ref={viewport}
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` }}
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>
    </div>
  );
}
