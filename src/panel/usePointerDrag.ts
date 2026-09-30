import type { JSX } from "preact";

export interface DragOptions {
  coords?: "screen" | "client";
  onStart?: () => void;
  onMove: (dx: number, dy: number) => void;
  onEnd?: () => void;
  ignore?: string;
}

export function pointerDragHandler<T extends HTMLElement>(
  options: DragOptions,
): (event: JSX.TargetedPointerEvent<T>) => void {
  const useScreen = options.coords !== "client";
  return (event) => {
    if (event.button !== 0) return;
    if (options.ignore && (event.target as HTMLElement).closest(options.ignore)) return;
    const el = event.currentTarget;
    el.setPointerCapture(event.pointerId);
    options.onStart?.();
    let lastX = useScreen ? event.screenX : event.clientX;
    let lastY = useScreen ? event.screenY : event.clientY;

    let pendingDx = 0;
    let pendingDy = 0;
    let frame = 0;

    const flush = (): void => {
      frame = 0;
      if (pendingDx === 0 && pendingDy === 0) return;
      const dx = pendingDx;
      const dy = pendingDy;
      pendingDx = 0;
      pendingDy = 0;
      options.onMove(dx, dy);
    };

    const move = (e: PointerEvent): void => {
      const x = useScreen ? e.screenX : e.clientX;
      const y = useScreen ? e.screenY : e.clientY;
      pendingDx += x - lastX;
      pendingDy += y - lastY;
      lastX = x;
      lastY = y;
      if (frame) return;
      frame = requestAnimationFrame(flush);
    };
    const up = (): void => {
      if (frame) {
        cancelAnimationFrame(frame);
        flush();
      }
      options.onEnd?.();
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
  };
}
