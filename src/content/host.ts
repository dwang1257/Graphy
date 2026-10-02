import { PANEL_CHANNEL, isPanelMessage, type ToPanel } from "../shared/protocol.js";
import { DEFAULT_PANEL, loadPanelState, savePanelState, type PanelState } from "../settings/storage.js";
import {
  RESIZE_CORNERS,
  RESIZE_HIT_PX,
  SHRINK_HIT,
  SHELL_RADIUS_PX,
  SHRINK_EASE,
  SHRINK_MS,
  TITLEBAR_PX,
  applyShellStyles,
  clampPanelBox,
  clipAnimation,
  createStyleWriter,
  liveResizeRect,
  resizeHitPosition,
  shrinkHitPosition,
  shellClipPath,
  type Box,
  type ResizeCorner,
} from "./shellLayout.js";

const HOST_ID = "graphy-root";

type Resize = {
  start: Box;
  corner: ResizeCorner;
  hit: HTMLButtonElement;
  pointerId: number;
  startX: number;
  startY: number;
  pointerX: number;
  pointerY: number;
};

export interface PanelHostOptions {
  onOpenChange?: (open: boolean) => void;
}

const STYLE = `
:host {
  all: initial;
  --color-paper: oklch(99% 0.004 250);
  --color-ink: oklch(22% 0.02 255);
  --color-accent: oklch(46% 0.18 305);
  --color-accent-ink: oklch(98% 0.012 305);
  --color-focus: oklch(48% 0.2 305);
  --font-body: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
.layer {
  position: fixed;
  z-index: 2147483647;
  left: 0;
  top: 0;
  width: 0;
  height: 0;
  transform: translate3d(0, 0, 0);
}
.shell {
  position: fixed;
  z-index: 0;
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
.shrink-hit,
.resize-hit {
  appearance: none;
  -webkit-appearance: none;
  position: fixed;
  z-index: 1;
  padding: 0;
  border: 0;
  background: transparent;
  touch-action: none;
}
.shrink-hit {
  width: ${SHRINK_HIT.width}px;
  height: ${SHRINK_HIT.height}px;
  cursor: pointer;
}
.resize-hit {
  width: ${RESIZE_HIT_PX}px;
  height: ${RESIZE_HIT_PX}px;
  cursor: nwse-resize;
}
.resize-hit[data-corner="ne"],
.resize-hit[data-corner="sw"] { cursor: nesw-resize; }
.shrink-hit[hidden],
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
  font: 600 12px/34px var(--font-body);
  letter-spacing: 0;
  cursor: pointer;
  box-shadow: none;
}
@media (hover: hover) {
  .launcher:hover { background: var(--color-ink); border-color: var(--color-ink); color: var(--color-paper); }
}
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

export function queuePanelMessage(pending: Map<string, ToPanel>, message: ToPanel): void {
  pending.set(message.type === "shrunk" ? "shrunk" : "content", message);
}

function makeDiv(className: string): HTMLDivElement {
  const el = document.createElement("div");
  el.className = className;
  return el;
}

function makeButton(className: string, label?: string): HTMLButtonElement {
  const el = document.createElement("button");
  el.className = className;
  el.type = "button";
  if (label) el.setAttribute("aria-label", label);
  return el;
}

function makeResizeHit(corner: ResizeCorner): HTMLButtonElement {
  const hit = makeButton("resize-hit", RESIZE_LABELS[corner]);
  hit.dataset.corner = corner;
  return hit;
}

function setAttr(el: HTMLElement, name: string, value: string): void {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

function setHidden(el: HTMLElement, hidden: boolean): void {
  if (el.hidden !== hidden) el.hidden = hidden;
}

export class PanelHost {
  private readonly root: ShadowRoot;
  private readonly frameOrigin: string;
  private readonly write = createStyleWriter();
  private readonly layer = makeDiv("layer");
  private readonly shell = makeDiv("shell");
  private readonly frame = document.createElement("iframe");
  private readonly shrinkHit = makeButton("shrink-hit", "Shrink panel");
  private readonly resizeHits: Record<ResizeCorner, HTMLButtonElement> = {
    nw: makeResizeHit("nw"),
    ne: makeResizeHit("ne"),
    sw: makeResizeHit("sw"),
    se: makeResizeHit("se"),
  };
  private readonly launcher = makeButton("launcher");
  private resizing: Resize | null = null;
  private state: PanelState = { ...DEFAULT_PANEL };
  private anchor = { x: 0, y: 0 };
  private ready = false;
  private pending = new Map<string, ToPanel>();
  private saveTimer: number | undefined;
  private clipAnim: Animation | undefined;
  private clipSettled = true;
  private resizeRaf: number | null = null;
  private moveRaf: number | null = null;
  private pendingDx = 0;
  private pendingDy = 0;
  readonly restored: Promise<void>;

  constructor(
    private frameUrl: string,
    private options: PanelHostOptions = {},
  ) {
    const frameLocation = new URL(frameUrl);
    this.frameOrigin = `${frameLocation.protocol}//${frameLocation.host}`;
    document.getElementById(HOST_ID)?.remove();

    const host = document.createElement("div");
    host.id = HOST_ID;
    host.style.cssText = "all: initial; position: static;";
    this.root = host.attachShadow({ mode: "closed" });
    (document.body ?? document.documentElement).appendChild(host);

    const style = document.createElement("style");
    style.textContent = STYLE;
    this.shell.dataset.open = "false";
    this.frame.setAttribute("title", "Graphy visualizer");
    this.shell.appendChild(this.frame);
    this.shrinkHit.addEventListener("click", this.onShrinkClick);
    for (const hit of Object.values(this.resizeHits)) hit.addEventListener("pointerdown", this.onResizePointerDown);
    this.launcher.textContent = "Graphy";
    this.launcher.addEventListener("click", () => this.open());

    this.layer.append(this.shell, this.shrinkHit, ...RESIZE_CORNERS.map((corner) => this.resizeHits[corner]));
    this.root.append(style, this.layer, this.launcher);
    window.addEventListener("message", this.onMessage);
    window.addEventListener("resize", this.clamp);
    this.restored = this.restore();
  }

  private async restore(): Promise<void> {
    this.state = await loadPanelState();
    if (this.state.x < 0 || this.state.y < 0) this.placeDefault();
    if (this.state.open) this.ensureFrame();
    this.clamp();
  }

  private ensureFrame(): void {
    if (this.frame.getAttribute("src")) return;
    this.frame.src = this.frameUrl;
  }

  private placeDefault(): void {
    this.state.x = Math.max(16, window.innerWidth - this.state.width - 24);
    this.state.y = Math.max(16, window.innerHeight - this.state.height - 24);
  }

  private layout(box: Box = this.state, clipPath?: string): void {
    applyShellStyles(this.shell, this.frame, { ...this.state, ...box }, {
      settle: this.clipSettled && this.state.shrunk,
      clipPath: clipPath ?? (this.clipSettled ? undefined : false),
      write: this.write,
    });
    this.anchor = { x: box.x, y: box.y };
    this.write(this.layer, { transform: "" });
    setHidden(this.launcher, this.state.open);
    this.syncHits(box);
  }

  private paintOffset(): void {
    const dx = this.state.x - this.anchor.x;
    const dy = this.state.y - this.anchor.y;
    this.write(this.layer, { transform: dx === 0 && dy === 0 ? "" : `translate3d(${dx}px, ${dy}px, 0px)` });
  }

  private apply(): void {
    this.clipAnim?.cancel();
    this.clipAnim = undefined;
    this.clipSettled = true;
    this.layout();
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
    const from = shellClipPath(this.state.height, !shrunk);
    const to = shellClipPath(this.state.height, shrunk);
    this.state.shrunk = shrunk;
    this.clipAnim?.cancel();
    this.clipSettled = false;
    this.layout(this.state, from);

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
      this.layout();
    };
    this.send({ channel: PANEL_CHANNEL, type: "shrunk", shrunk });
    this.persist();
  }

  private viewport(): { width: number; height: number } {
    return { width: window.innerWidth, height: window.innerHeight };
  }

  private clampedBox(): Box {
    const { x, y, width, height, shrunk } = this.state;
    const next = clampPanelBox({ x, y, width, height: shrunk ? TITLEBAR_PX : height }, this.viewport());
    return { x: next.x, y: next.y, width: next.width, height: shrunk ? height : next.height };
  }

  private clamp = (): void => {
    if (this.resizing) return;
    Object.assign(this.state, this.clampedBox());
    this.apply();
  };

  private moveBy(dx: number, dy: number): void {
    if (this.resizing) return;
    this.state.x += dx;
    this.state.y += dy;
    const next = this.clampedBox();
    const resized = next.width !== this.state.width || next.height !== this.state.height;
    Object.assign(this.state, next);
    if (resized) this.apply();
    else this.paintOffset();
  }

  private syncHits(box: Box): void {
    const shrink = shrinkHitPosition(box);
    this.write(this.shrinkHit, { left: `${shrink.left}px`, top: `${shrink.top}px` });
    setHidden(this.shrinkHit, !this.state.open);
    setAttr(this.shrinkHit, "aria-label", this.state.shrunk ? "Expand panel" : "Shrink panel");
    setAttr(this.shrinkHit, "aria-pressed", String(this.state.shrunk));

    const hidden = !this.state.open || this.state.shrunk || !this.clipSettled;
    for (const corner of RESIZE_CORNERS) {
      const pos = resizeHitPosition(box, corner);
      const hit = this.resizeHits[corner];
      this.write(hit, { left: `${pos.left}px`, top: `${pos.top}px` });
      setHidden(hit, hidden);
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

  private cancelResizeFrame(): void {
    if (this.resizeRaf === null) return;
    cancelAnimationFrame(this.resizeRaf);
    this.resizeRaf = null;
  }

  private abortResize(): void {
    this.cancelResizeFrame();
    const resizing = this.resizing;
    if (!resizing) return;
    this.resizing = null;
    this.listenResize(resizing.hit, false);
    try {
      resizing.hit.releasePointerCapture(resizing.pointerId);
    } catch {}
  }

  private onResizePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0 || this.state.shrunk || !this.clipSettled || this.resizing) return;
    const corner = RESIZE_CORNERS.find((candidate) => this.resizeHits[candidate] === event.currentTarget);
    if (!corner) return;
    const hit = this.resizeHits[corner];
    event.preventDefault();
    this.flushMove();
    this.layout();
    try {
      hit.setPointerCapture(event.pointerId);
    } catch {}
    const { x, y, width, height } = this.state;
    this.resizing = {
      start: { x, y, width, height },
      corner,
      hit,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      pointerX: event.clientX,
      pointerY: event.clientY,
    };
    this.listenResize(hit, true);
  };

  private liveRect(resizing: Resize): Box {
    return liveResizeRect(
      resizing.start,
      resizing.corner,
      { dx: resizing.pointerX - resizing.startX, dy: resizing.pointerY - resizing.startY },
      this.viewport(),
    );
  }

  private trackResizePointer(event: PointerEvent): void {
    if (!this.resizing || event.type === "pointercancel") return;
    this.resizing.pointerX = event.clientX;
    this.resizing.pointerY = event.clientY;
  }

  private onResizePointerMove = (event: PointerEvent): void => {
    if (!this.resizing) return;
    this.trackResizePointer(event);
    if (this.resizeRaf !== null) return;
    this.resizeRaf = requestAnimationFrame(() => {
      this.resizeRaf = null;
      if (this.resizing) this.layout(this.liveRect(this.resizing));
    });
  };

  private onResizePointerUp = (event: PointerEvent): void => {
    const resizing = this.resizing;
    if (!resizing) return;
    this.cancelResizeFrame();
    this.trackResizePointer(event);
    this.listenResize(resizing.hit, false);
    this.resizing = null;
    Object.assign(this.state, this.liveRect(resizing));
    this.persist();
    this.apply();
  };

  private flushMove(): void {
    if (this.moveRaf !== null) {
      cancelAnimationFrame(this.moveRaf);
      this.moveRaf = null;
    }
    if (this.pendingDx === 0 && this.pendingDy === 0) return;
    const dx = this.pendingDx;
    const dy = this.pendingDy;
    this.pendingDx = 0;
    this.pendingDy = 0;
    this.moveBy(dx, dy);
  }

  private persist(): void {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void savePanelState(this.state), 400);
  }

  private setOpen(open: boolean): void {
    const changed = this.state.open !== open;
    this.state.open = open;
    if (open) this.ensureFrame();
    this.apply();
    this.persist();
    if (changed) this.options.onOpenChange?.(open);
  }

  get isOpen(): boolean {
    return this.state.open;
  }

  open(): void {
    this.setOpen(true);
  }

  close(): void {
    this.setOpen(false);
  }

  toggle(): void {
    this.setOpen(!this.state.open);
  }

  send(message: ToPanel): void {
    if (!this.ready) {
      queuePanelMessage(this.pending, message);
      return;
    }
    this.frame.contentWindow?.postMessage(message, this.frameOrigin);
  }

  destroy(): void {
    this.clipAnim?.cancel();
    this.abortResize();
    window.removeEventListener("message", this.onMessage);
    window.removeEventListener("resize", this.clamp);
    if (this.moveRaf !== null) cancelAnimationFrame(this.moveRaf);
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
        this.pendingDx += data.dx;
        this.pendingDy += data.dy;
        if (this.moveRaf !== null) break;
        this.moveRaf = requestAnimationFrame(() => {
          this.moveRaf = null;
          this.flushMove();
        });
        break;
      case "persist":
        this.flushMove();
        this.layout();
        this.persist();
        break;
      case "setShrunk":
        this.setShrunk(data.shrunk);
        break;
    }
  };
}
