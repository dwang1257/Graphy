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

    const move = (e: PointerEvent): void => {
      const x = useScreen ? e.screenX : e.clientX;
      const y = useScreen ? e.screenY : e.clientY;
      options.onMove(x - lastX, y - lastY);
      lastX = x;
      lastY = y;
    };
    const up = (): void => {
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
