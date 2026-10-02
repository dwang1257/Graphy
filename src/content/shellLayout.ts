export const TITLEBAR_PX = 40;
export const SHELL_RADIUS_PX = 12;
export const SHRINK_MS = 160;
export const SHRINK_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";
export const MIN_PANEL_WIDTH = 280;
export const MIN_PANEL_HEIGHT = 180;
export const RESIZE_HIT_PX = 16;

const TITLEBAR_ICON_PX = 28;
const TITLEBAR_PAD_PX = 12;
const TITLEBAR_GAP_PX = 12;
const ICON_SLOP_PX = 6;

export const SHRINK_HIT = {
  top: (TITLEBAR_PX - TITLEBAR_ICON_PX) / 2 - ICON_SLOP_PX,
  right: TITLEBAR_PAD_PX + TITLEBAR_ICON_PX + TITLEBAR_GAP_PX - ICON_SLOP_PX,
  width: TITLEBAR_ICON_PX + ICON_SLOP_PX * 2,
  height: TITLEBAR_ICON_PX + ICON_SLOP_PX * 2,
};

export type Box = { x: number; y: number; width: number; height: number };
type Size = { width: number; height: number };
type Point = { left: number; top: number };

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

export const RESIZE_CORNERS: ResizeCorner[] = ["nw", "ne", "sw", "se"];

export type StyleWriter = (el: HTMLElement, styles: Record<string, string>) => void;

function writeStylesDirect(el: HTMLElement, styles: Record<string, string>): void {
  for (const [prop, value] of Object.entries(styles)) el.style.setProperty(prop, value);
}

export function createStyleWriter(): StyleWriter {
  const written = new WeakMap<HTMLElement, Map<string, string>>();
  return (el, styles) => {
    let known = written.get(el);
    if (!known) {
      known = new Map();
      written.set(el, known);
    }
    for (const [prop, value] of Object.entries(styles)) {
      if (known.get(prop) === value) continue;
      known.set(prop, value);
      el.style.setProperty(prop, value);
    }
  };
}

export function shrinkHitPosition(box: Box): Point {
  return {
    left: box.x + box.width - SHRINK_HIT.right - SHRINK_HIT.width,
    top: box.y + SHRINK_HIT.top,
  };
}

export function clipAnimation(from: string, to: string): Keyframe[] {
  return [{ clipPath: from }, { clipPath: to }];
}

export function shellClipPath(height: number, shrunk: boolean, settle = false): string {
  const bottom = !shrunk || settle ? 0 : Math.max(0, height - TITLEBAR_PX);
  return `inset(0px 0px ${bottom}px 0px round ${SHELL_RADIUS_PX}px)`;
}

export function applyShellStyles(
  shell: HTMLElement,
  frame: HTMLElement,
  state: Box & { open: boolean; shrunk: boolean },
  options: { settle?: boolean; clipPath?: string | false; write?: StyleWriter } = {},
): void {
  const settle = options.settle === true;
  const write = options.write ?? writeStylesDirect;
  const open = String(state.open);
  if (shell.dataset.open !== open) shell.dataset.open = open;
  const styles: Record<string, string> = {
    left: `${state.x}px`,
    top: `${state.y}px`,
    width: `${state.width}px`,
    height: `${state.shrunk && settle ? TITLEBAR_PX : state.height}px`,
  };
  if (options.clipPath !== false) {
    styles["clip-path"] = settle || options.clipPath === undefined
      ? shellClipPath(state.height, state.shrunk, settle)
      : options.clipPath;
  }
  write(shell, styles);
  write(frame, { width: `${state.width}px`, height: `${state.height}px` });
}

export function clampPanelBox(box: Box, viewport: Size): Box {
  const width = Math.min(Math.max(MIN_PANEL_WIDTH, box.width), Math.max(MIN_PANEL_WIDTH, viewport.width));
  const height = Math.min(Math.max(MIN_PANEL_HEIGHT, box.height), Math.max(MIN_PANEL_HEIGHT, viewport.height));
  return {
    x: Math.min(Math.max(0, box.x), Math.max(0, viewport.width - width)),
    y: Math.min(Math.max(0, box.y), Math.max(0, viewport.height - height)),
    width,
    height,
  };
}

export function resizeHitPosition(box: Box, corner: ResizeCorner): Point {
  return {
    left: corner.includes("w") ? box.x : box.x + box.width - RESIZE_HIT_PX,
    top: corner.includes("n") ? box.y : box.y + box.height - RESIZE_HIT_PX,
  };
}

function clampResizeAxis(
  pos: number,
  size: number,
  minSize: number,
  maxBound: number,
  anchored: boolean,
  farEdge: number,
): { pos: number; size: number } {
  if (size < minSize) {
    size = minSize;
    if (anchored) pos = farEdge - size;
  }
  if (pos < 0) {
    pos = 0;
    if (anchored) size = farEdge;
  }
  const maxSize = Math.max(minSize, maxBound - pos);
  if (size > maxSize) {
    size = maxSize;
    if (anchored) pos = farEdge - size;
  }
  return { pos, size };
}

export function liveResizeRect(
  start: Box,
  corner: ResizeCorner,
  pointer: { dx: number; dy: number },
  viewport: Size,
): Box {
  const west = corner.includes("w");
  const north = corner.includes("n");
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  const x = west ? start.x + pointer.dx : start.x;
  const y = north ? start.y + pointer.dy : start.y;
  const horizontal = clampResizeAxis(x, west ? right - x : start.width + pointer.dx, MIN_PANEL_WIDTH, viewport.width, west, right);
  const vertical = clampResizeAxis(y, north ? bottom - y : start.height + pointer.dy, MIN_PANEL_HEIGHT, viewport.height, north, bottom);
  return { x: horizontal.pos, y: vertical.pos, width: horizontal.size, height: vertical.size };
}
