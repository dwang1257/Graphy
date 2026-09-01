export interface View {
  x: number;
  y: number;
  scale: number;
}

interface Point {
  x: number;
  y: number;
}

const MIN_SCALE = 0.15;
const MAX_SCALE = 6;
const LINE_HEIGHT_PX = 16;
const ZOOM_SENSITIVITY = 0.004;
const DELTA_MODE_LINE = 1;
const DELTA_MODE_PAGE = 2;

export function normalizeWheelDelta(deltaY: number, deltaMode: number, pageHeight: number): number {
  if (deltaMode === DELTA_MODE_LINE) return deltaY * LINE_HEIGHT_PX;
  if (deltaMode === DELTA_MODE_PAGE) return deltaY * pageHeight;
  return deltaY;
}

export function zoomAtPoint(view: View, point: Point, deltaPixels: number): View {
  const factor = Math.exp(-deltaPixels * ZOOM_SENSITIVITY);
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, view.scale * factor));
  const ratio = scale / view.scale;

  return {
    scale,
    x: point.x - (point.x - view.x) * ratio,
    y: point.y - (point.y - view.y) * ratio,
  };
}
