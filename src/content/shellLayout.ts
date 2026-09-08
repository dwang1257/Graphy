/** Matches `--titlebar-height` in the panel. The host clips to this when shrunk. */
export const TITLEBAR_PX = 40;
/** Title bar control size — keep in sync with `--titlebar-control` in `styles.css`. */
export const TITLEBAR_ICON_PX = 28;
/** Title bar `padding-right` — keep in sync with `.titlebar` in `styles.css`. */
export const TITLEBAR_PAD_PX = 12;
/** Title bar flex `gap` — keep in sync with `.titlebar` in `styles.css`. */
export const TITLEBAR_GAP_PX = 12;
/** Matches `.icon-btn::before { inset: -6px }`. */
export const ICON_SLOP_PX = 6;

/** Host overlay over the shrink chevron, including the icon's expanded hit area. */
export function shrinkHitOffset(): { top: number; right: number; width: number; height: number } {
  const padY = (TITLEBAR_PX - TITLEBAR_ICON_PX) / 2;
  const right = TITLEBAR_PAD_PX + TITLEBAR_ICON_PX + TITLEBAR_GAP_PX - ICON_SLOP_PX;
  const size = TITLEBAR_ICON_PX + ICON_SLOP_PX * 2;
  return { top: padY - ICON_SLOP_PX, right, width: size, height: size };
}

/** Viewport position for a hit target that sits above the OOP iframe, not inside it. */
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
  /** Host layout box. Stays expanded during the clip animation. */
  shell: ShellBox;
  /** Iframe paint size. Always the expanded window so the document never reflows. */
  iframe: ShellBox;
  /** Compositor clip. Pixel insets interpolate; `inset(0)` does not. */
  clipPath: string;
}

export const SHRINK_MS = 160;
export const SHRINK_EASE = "cubic-bezier(0.16, 1, 0.3, 1)";

export interface ApplyShellOptions {
  animate: boolean;
  /** After the clip animation, collapse the hit box to the title bar. */
  settle?: boolean;
  /** `false` leaves the current clip so WAAPI can interpolate it. */
  clipPath?: string | false;
}

export function clipAnimation(from: string, to: string): Keyframe[] {
  return [{ clipPath: from }, { clipPath: to }];
}

export function shellClipPath(height: number, shrunk: boolean, settle = false): string {
  if (!shrunk || settle) return "inset(0px)";
  return `inset(0px 0px ${Math.max(0, height - TITLEBAR_PX)}px 0px)`;
}

/** Hidden while closed, clipped, or still expanding onto the page. */
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

/** Applies clip vs paint sizes. Iframe pixels stay put when only `shrunk` changes. */
export function applyShellStyles(
  shell: HTMLElement,
  frame: HTMLElement,
  state: { x: number; y: number; width: number; height: number; open: boolean; shrunk: boolean },
  options: ApplyShellOptions,
): void {
  const { shell: box, iframe, clipPath } = shellGeometry(state, options.settle === true);
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
    next.clipPath = options.clipPath ?? clipPath;
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

/** Live resize uses transform only — iframe pixels stay at `from`. */
export function applyResizePreview(
  shell: HTMLElement,
  from: { width: number; height: number },
  to: { width: number; height: number },
): void {
  const { sx, sy } = resizeScale(from, to);
  shell.style.willChange = "transform";
  shell.style.transformOrigin = "top left";
  shell.style.transform = `scale(${sx}, ${sy})`;
}

export function clearResizePreview(shell: HTMLElement): void {
  shell.style.transform = "";
  shell.style.transformOrigin = "";
  shell.style.willChange = "";
}

export function resizeHitPosition(state: { x: number; y: number; width: number; height: number }): {
  left: number;
  top: number;
} {
  return {
    left: state.x + state.width - RESIZE_HIT_PX,
    top: state.y + state.height - RESIZE_HIT_PX,
  };
}
