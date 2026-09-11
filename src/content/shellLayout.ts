export const TITLEBAR_PX = 40;
export const SHELL_RADIUS_PX = 12;
export const TITLEBAR_ICON_PX = 28;
export const TITLEBAR_PAD_PX = 12;
export const TITLEBAR_GAP_PX = 12;
export const ICON_SLOP_PX = 6;

export function shrinkHitOffset(): { top: number; right: number; width: number; height: number } {
  const padY = (TITLEBAR_PX - TITLEBAR_ICON_PX) / 2;
  const right = TITLEBAR_PAD_PX + TITLEBAR_ICON_PX + TITLEBAR_GAP_PX - ICON_SLOP_PX;
  const size = TITLEBAR_ICON_PX + ICON_SLOP_PX * 2;
  return { top: padY - ICON_SLOP_PX, right, width: size, height: size };
}

export function shrinkHitPosition(state: { x: number; y: number; width: number }): { left: number; top: number } {
  const hit = shrinkHitOffset();
  return {
    left: state.x + state.width - hit.right - hit.width,
    top: state.y + hit.top,
  };
}

export interface ShellBox {
  width: number;
  height: number;
}

export interface ShellGeometry {
  shell: ShellBox;
  iframe: ShellBox;
  clipPath: string;
}

export const SHRINK_MS = 160;
export const SHRINK_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export interface ApplyShellOptions {
  animate: boolean;
  settle?: boolean;
  clipPath?: string | false;
}

export function clipAnimation(from: string, to: string): Keyframe[] {
  return [{ clipPath: from }, { clipPath: to }];
}

export function shellClipPath(height: number, shrunk: boolean, settle = false): string {
  const radius = `round ${SHELL_RADIUS_PX}px`;
  const bottom = !shrunk || settle ? 0 : Math.max(0, height - TITLEBAR_PX);
  return `inset(0px 0px ${bottom}px 0px ${radius})`;
}

export function resizeHitHidden(
  state: { open: boolean; shrunk: boolean },
  clipSettled: boolean,
): boolean {
  return !state.open || state.shrunk || !clipSettled;
}

export function shellGeometry(
  state: { width: number; height: number; shrunk: boolean },
  settle = false,
): ShellGeometry {
  const iframe = { width: state.width, height: state.height };
  return {
    iframe,
    shell: {
      width: state.width,
      height: state.shrunk && settle ? TITLEBAR_PX : state.height,
    },
    clipPath: shellClipPath(state.height, state.shrunk, settle),
  };
}

type ShellLayoutState = {
  x: number;
  y: number;
  width: number;
  height: number;
  open: boolean;
  shrunk: boolean;
};

export function applyShellStyles(
  shell: HTMLElement,
  frame: HTMLElement,
  state: ShellLayoutState,
  options: ApplyShellOptions,
): void {
  const settle = options.settle === true;
  const { shell: box, iframe, clipPath } = shellGeometry(state, settle);
  shell.dataset.open = String(state.open);
  shell.dataset.shrunk = String(state.shrunk);
  shell.dataset.animate = String(options.animate);
  const next: Record<string, string> = {
    left: `${state.x}px`,
    top: `${state.y}px`,
    width: `${box.width}px`,
    height: `${box.height}px`,
  };
  if (options.clipPath !== false) {
    next.clipPath = settle ? clipPath : (options.clipPath ?? clipPath);
  }
  Object.assign(shell.style, next);
  Object.assign(frame.style, {
    width: `${iframe.width}px`,
    height: `${iframe.height}px`,
  });
}

export const MIN_PANEL_WIDTH = 280;
export const MIN_PANEL_HEIGHT = 180;
export const RESIZE_HIT_PX = 16;

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

export const RESIZE_CORNERS: ResizeCorner[] = ["nw", "ne", "sw", "se"];

export function clampPanelSize(
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  origin: { x: number; y: number },
): { width: number; height: number } {
  const maxW = Math.max(MIN_PANEL_WIDTH, viewport.width - origin.x);
  const maxH = Math.max(MIN_PANEL_HEIGHT, viewport.height - origin.y);
  return {
    width: Math.min(maxW, Math.max(MIN_PANEL_WIDTH, size.width)),
    height: Math.min(maxH, Math.max(MIN_PANEL_HEIGHT, size.height)),
  };
}

export function resizeScale(
  from: { width: number; height: number },
  to: { width: number; height: number },
): { sx: number; sy: number } {
  return { sx: to.width / from.width, sy: to.height / from.height };
}

export function resizeTransformOrigin(corner: ResizeCorner): string {
  const x = corner.includes("w") ? "right" : "left";
  const y = corner.includes("n") ? "bottom" : "top";
  return `${y} ${x}`;
}

export function applyResizePreview(shell: HTMLElement, frame: HTMLElement, state: ShellLayoutState): void {
  clearResizePreview(shell);
  applyShellStyles(shell, frame, state, { animate: false, settle: state.shrunk });
}

export function clearResizePreview(shell: HTMLElement): void {
  shell.style.transform = "";
  shell.style.transformOrigin = "";
  shell.style.willChange = "";
}

export function resizeHitPosition(
  state: { x: number; y: number; width: number; height: number },
  corner: ResizeCorner = "se",
): { left: number; top: number } {
  return {
    left: corner.includes("w") ? state.x : state.x + state.width - RESIZE_HIT_PX,
    top: corner.includes("n") ? state.y : state.y + state.height - RESIZE_HIT_PX,
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
  start: { x: number; y: number; width: number; height: number },
  corner: ResizeCorner,
  pointer: { dx: number; dy: number },
  viewport: { width: number; height: number },
): { x: number; y: number; width: number; height: number } {
  const west = corner.includes("w");
  const north = corner.includes("n");
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  let x = west ? start.x + pointer.dx : start.x;
  let y = north ? start.y + pointer.dy : start.y;
  let width = west ? right - x : start.width + pointer.dx;
  let height = north ? bottom - y : start.height + pointer.dy;
  ({ pos: x, size: width } = clampResizeAxis(x, width, MIN_PANEL_WIDTH, viewport.width, west, right));
  ({ pos: y, size: height } = clampResizeAxis(y, height, MIN_PANEL_HEIGHT, viewport.height, north, bottom));
  return { x, y, width, height };
}
