import { PANEL_CHANNEL, isPanelMessage, type ToPanel } from "../shared/protocol.js";
import { DEFAULT_PANEL, loadPanelState, savePanelState, type PanelState } from "../settings/storage.js";
import { notifyPageTrace } from "./pageTrace.js";
import {
  RESIZE_CORNERS,
  RESIZE_HIT_PX,
  SHELL_RADIUS_PX,
  SHRINK_EASE,
  SHRINK_MS,
  applyResizePreview,
  applyShellStyles,
  clampPanelSize,
  clearResizePreview,
  clipAnimation,
  liveResizeRect,
  type ResizeCorner,
  resizeHitHidden,
  resizeHitPosition,
  shellClipPath,
  shrinkHitOffset,
  shrinkHitPosition,
} from "./shellLayout.js";

const HIT = shrinkHitOffset();
const HOST_ID = "graphy-root";

type Box = { x: number; y: number; width: number; height: number };

const STYLE = `
:host {
  all: initial;
  --color-paper: oklch(99% 0.004 250);
  --color-ink: oklch(22% 0.02 255);
  --color-accent: oklch(46% 0.18 305);
  --color-accent-ink: oklch(98% 0.012 305);
  --color-rule: oklch(84% 0.012 250);
  --color-focus: oklch(48% 0.2 305);
  --font-body: "Outfit", ui-sans-serif, system-ui, sans-serif;
}
.shell {
  position: fixed;
  z-index: 2147483646;
  border: 0;
  border-radius: ${SHELL_RADIUS_PX}px;
  overflow: hidden;
  clip-path: inset(0 round ${SHELL_RADIUS_PX}px);
  box-shadow: none;
  background: transparent;
  display: none;
}
.shell[data-open="true"] { display: block; }
.shell iframe {
  position: absolute;
  top: 0;
  left: 0;
  border: 0;
  display: block;
  transform: translateZ(0);
}
.shrink-hit {
  appearance: none;
  -webkit-appearance: none;
  position: fixed;
  z-index: 2147483647;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
  touch-action: none;
}
.shrink-hit[hidden] { display: none; }
.resize-hit {
  appearance: none;
  -webkit-appearance: none;
  position: fixed;
  z-index: 2147483647;
  width: ${RESIZE_HIT_PX}px;
  height: ${RESIZE_HIT_PX}px;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: nwse-resize;
  touch-action: none;
}
.resize-hit[data-corner="ne"],
.resize-hit[data-corner="sw"] { cursor: nesw-resize; }
.resize-hit[hidden] { display: none; }
.launcher {
  appearance: none;
  -webkit-appearance: none;
  position: fixed;
  z-index: 2147483645;
  right: 20px;
  bottom: 20px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--color-accent);
  border-radius: 0;
  background: var(--color-accent);
  color: var(--color-accent-ink);
  font: 600 12px/36px var(--font-body);
  letter-spacing: -0.01em;
  text-transform: capitalize;
  cursor: pointer;
  box-shadow: none;
}
.launcher:hover { background: var(--color-ink); border-color: var(--color-ink); color: var(--color-paper); }
.launcher:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.launcher:active { transform: translateY(1px); }
.launcher[hidden] { display: none; }
`;

const RESIZE_LABELS: Record<ResizeCorner, string> = {
  nw: "Resize panel from top left",
  ne: "Resize panel from top right",
  sw: "Resize panel from bottom left",
  se: "Resize panel from bottom right",
};

function makeButton(className: string, label?: string): HTMLButtonElement {
  const el = document.createElement("button");
  el.className = className;
  el.type = "button";
  if (label) el.setAttribute("aria-label", label);
  return el;
}

export class PanelHost {
  private root: ShadowRoot;
  private readonly frameOrigin: string;
  private shell!: HTMLDivElement;
  private frame!: HTMLIFrameElement;
  private shrinkHit!: HTMLButtonElement;
  private resizeHits!: Record<ResizeCorner, HTMLButtonElement>;
  private launcher!: HTMLButtonElement;
  private resizing: (Box & {
    startX: number;
    startY: number;
    corner: ResizeCorner;
    hit: HTMLButtonElement;
  }) | null = null;
  private state: PanelState = { ...DEFAULT_PANEL };
  private ready = false;
  private pending = new Map<string, ToPanel>();
  private saveTimer: number | undefined;
  private clipAnim: Animation | undefined;
  private clipSettled = true;
  private resizePointerId: number | undefined;
  readonly restored: Promise<void>;

  constructor(private frameUrl: string) {
    const frameLocation = new URL(frameUrl);
    this.frameOrigin = `${frameLocation.protocol}//${frameLocation.host}`;
    document.getElementById(HOST_ID)?.remove();

    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "all: initial; position: static;";
    this.root = host.attachShadow({ mode: "closed" });
    (document.body ?? document.documentElement).appendChild(host);
    this.restored = this.build();
  }

  private async build(): Promise<void> {
    const style = document.createElement("style");
    style.textContent = STYLE;

    this.shell = document.createElement("div");
    this.shell.className = "shell";
    this.shell.dataset.open = "false";

    this.frame = document.createElement("iframe");
    this.frame.src = this.frameUrl;
    this.frame.setAttribute("title", "Graphy Visualizer");
    this.shell.appendChild(this.frame);

    this.shrinkHit = makeButton("shrink-hit", "Shrink panel");
    this.shrinkHit.addEventListener("click", this.onShrinkClick);

    this.resizeHits = {} as Record<ResizeCorner, HTMLButtonElement>;
    for (const corner of RESIZE_CORNERS) {
      const hit = makeButton("resize-hit", RESIZE_LABELS[corner]);
      hit.dataset.corner = corner;
      hit.addEventListener("pointerdown", this.onResizePointerDown);
      this.resizeHits[corner] = hit;
    }

    this.launcher = makeButton("launcher");
    this.launcher.textContent = "Graphy";
    this.launcher.addEventListener("click", () => this.open());

    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap";

    this.root.append(fonts, style, this.shell, this.shrinkHit, ...RESIZE_CORNERS.map((c) => this.resizeHits[c]), this.launcher);
    window.addEventListener("message", this.onMessage);
    window.addEventListener("resize", this.clamp);

    const state = await loadPanelState();
    this.state = state;
    if (state.x < 0 || state.y < 0) this.placeDefault();
    this.clamp();
  }

  private placeDefault(): void {
    this.state.x = Math.max(16, window.innerWidth - this.state.width - 24);
    this.state.y = Math.max(16, window.innerHeight - this.state.height - 24);
  }

  private paint(settle: boolean, clipPath?: string): void {
    applyShellStyles(this.shell, this.frame, this.state, {
      animate: false,
      settle,
      ...(clipPath === undefined ? {} : { clipPath }),
    });
    this.launcher.hidden = this.state.open;
    this.syncHits();
  }

  private apply(): void {
    this.clipAnim?.cancel();
    this.clipAnim = undefined;
    this.clipSettled = true;
    clearResizePreview(this.shell);
    this.paint(this.state.shrunk);
    notifyPageTrace(this.state.open);
  }

  private onShrinkClick = (): void => {
    this.setShrunk(!this.state.shrunk);
  };

  private setShrunk(shrunk: boolean): void {
    if (this.state.shrunk === shrunk) {
      this.send({ channel: PANEL_CHANNEL, type: "shrunk", shrunk });
      return;
    }
    this.abortResize();
    const height = this.state.height;
    const from = shellClipPath(height, this.state.shrunk);
    this.state.shrunk = shrunk;
    const to = shellClipPath(height, shrunk);
    this.clipAnim?.cancel();
    this.clipSettled = false;
    this.paint(false, from);

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.clipAnim = this.shell.animate(clipAnimation(from, to), {
      duration: reduce ? 0 : SHRINK_MS,
      easing: SHRINK_EASE,
      fill: "forwards",
    });
    this.clipAnim.onfinish = () => {
      this.clipAnim?.cancel();
      if (this.state.shrunk !== shrunk) return;
      this.clipSettled = true;
      this.paint(this.state.shrunk);
    };
    this.send({ channel: PANEL_CHANNEL, type: "shrunk", shrunk });
    this.persist();
  }

  private viewport(): { width: number; height: number } {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  private clamp = (): void => {
    if (this.resizing) return;
    const view = this.viewport();
    const size = clampPanelSize(
      { width: this.state.width, height: this.state.height },
      view,
      { x: this.state.x, y: this.state.y },
    );
    this.state.width = size.width;
    this.state.height = size.height;
    this.state.x = Math.min(Math.max(0, this.state.x), Math.max(0, view.width - 80));
    this.state.y = Math.min(Math.max(0, this.state.y), Math.max(0, view.height - 40));
    this.apply();
  };

  private syncHits(box: Box = this.state): void {
    const shrink = shrinkHitPosition(box);
    Object.assign(this.shrinkHit.style, {
      left: `${shrink.left}px`,
      top: `${shrink.top}px`,
      width: `${HIT.width}px`,
      height: `${HIT.height}px`,
    });
    this.shrinkHit.hidden = !this.state.open;
    this.shrinkHit.setAttribute("aria-label", this.state.shrunk ? "Expand panel" : "Shrink panel");
    this.shrinkHit.setAttribute("aria-pressed", String(this.state.shrunk));

    const hidden = resizeHitHidden(this.state, this.clipSettled);
    for (const corner of RESIZE_CORNERS) {
      const pos = resizeHitPosition(box, corner);
      Object.assign(this.resizeHits[corner].style, {
        left: `${pos.left}px`,
        top: `${pos.top}px`,
      });
      this.resizeHits[corner].hidden = hidden;
    }
  }

  private listenResize(hit: HTMLButtonElement, on: boolean): void {
    if (on) {
      hit.addEventListener("pointermove", this.onResizePointerMove);
      hit.addEventListener("pointerup", this.onResizePointerUp);
      hit.addEventListener("pointercancel", this.onResizePointerUp);
      return;
    }
    hit.removeEventListener("pointermove", this.onResizePointerMove);
    hit.removeEventListener("pointerup", this.onResizePointerUp);
    hit.removeEventListener("pointercancel", this.onResizePointerUp);
  }

  private abortResize(): void {
    const hit = this.resizing?.hit;
    if (this.resizing) {
      this.resizing = null;
      if (hit) this.listenResize(hit, false);
    }
    if (this.resizePointerId !== undefined) {
      try {
        hit?.releasePointerCapture(this.resizePointerId);
      } catch {}
      this.resizePointerId = undefined;
    }
    clearResizePreview(this.shell);
  }

  private onResizePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.state.shrunk || !this.clipSettled) return;
    const hit = event.currentTarget;
    if (!(hit instanceof HTMLButtonElement)) return;
    const corner = hit.dataset.corner;
    if (!RESIZE_CORNERS.includes(corner as ResizeCorner)) return;
    event.preventDefault();
    applyResizePreview(this.shell, this.frame, this.state);
    this.syncHits();
    this.resizePointerId = event.pointerId;
    try {
      hit.setPointerCapture(event.pointerId);
    } catch {}
    this.resizing = {
      startX: event.clientX,
      startY: event.clientY,
      x: this.state.x,
      y: this.state.y,
      width: this.state.width,
      height: this.state.height,
      corner: corner as ResizeCorner,
      hit,
    };
    this.listenResize(hit, true);
  };

  private liveRect(event: PointerEvent): Box {
    const start = this.resizing!;
    return liveResizeRect(
      { x: start.x, y: start.y, width: start.width, height: start.height },
      start.corner,
      { dx: event.clientX - start.startX, dy: event.clientY - start.startY },
      this.viewport(),
    );
  }

  private onResizePointerMove = (event: PointerEvent): void => {
    if (!this.resizing) return;
    const next = this.liveRect(event);
    applyResizePreview(this.shell, this.frame, { ...this.state, ...next });
    this.syncHits(next);
  };

  private onResizePointerUp = (event: PointerEvent): void => {
    if (!this.resizing) return;
    const next = this.liveRect(event);
    this.listenResize(this.resizing.hit, false);
    this.resizing = null;
    this.resizePointerId = undefined;
    Object.assign(this.state, next);
    this.syncHits();
    this.persist();
    this.apply();
  };

  private persist(): void {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void savePanelState(this.state), 400);
  }

  private setOpen(open: boolean): void {
    this.state.open = open;
    this.apply();
    this.persist();
  }

  open(): void {
    this.setOpen(true);
  }

  get isOpen(): boolean {
    return this.state.open;
  }

  toggle(): void {
    if (this.state.open) this.close();
    else this.open();
  }

  close(): void {
    this.setOpen(false);
  }

  send(message: ToPanel): void {
    if (!this.ready) {
      this.pending.set(message.type, message);
      return;
    }
    this.frame.contentWindow?.postMessage(message, this.frameOrigin);
  }

  destroy(): void {
    this.clipAnim?.cancel();
    this.abortResize();
    this.shrinkHit.removeEventListener("click", this.onShrinkClick);
    for (const hit of Object.values(this.resizeHits)) {
      hit.removeEventListener("pointerdown", this.onResizePointerDown);
    }
    window.removeEventListener("message", this.onMessage);
    window.removeEventListener("resize", this.clamp);
    document.getElementById(HOST_ID)?.remove();
  }

  private onMessage = (event: MessageEvent): void => {
    if (event.source !== this.frame.contentWindow || event.origin !== this.frameOrigin) return;
    const data: unknown = event.data;
    if (!isPanelMessage(data)) return;

    switch (data.type) {
      case "ready": {
        this.ready = true;
        const queued = [...this.pending.values()];
        this.pending.clear();
        for (const message of queued) this.send(message);
        this.send({ channel: PANEL_CHANNEL, type: "shrunk", shrunk: this.state.shrunk });
        break;
      }
      case "close":
        this.close();
        break;
      case "move":
        this.state.x += data.dx;
        this.state.y += data.dy;
        this.clamp();
        break;
      case "persist":
        this.persist();
        break;
      case "setShrunk":
        this.setShrunk(data.shrunk);
        break;
    }
  };
}
