import { isPanelMessage, type ToPanel } from "../shared/protocol.js";
import { DEFAULT_PANEL, loadPanelState, savePanelState, type PanelState } from "../settings/storage.js";

const HOST_ID = "graphy-root";
const COLLAPSED_HEIGHT = 40;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 220;

const STYLE = `
:host { all: initial; }
.shell {
  position: fixed;
  z-index: 2147483646;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 0 0 1px oklch(0% 0 0 / 0.08), 0 12px 32px oklch(0% 0 0 / 0.18);
  background: oklch(99% 0.004 250);
  transition: height 160ms cubic-bezier(0.16, 1, 0.3, 1);
  display: none;
}
.shell[data-open="true"] { display: block; }
.shell iframe { width: 100%; height: 100%; border: 0; display: block; }
.launcher {
  position: fixed;
  z-index: 2147483645;
  right: 20px;
  bottom: 20px;
  height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: oklch(62% 0.19 255);
  color: oklch(99% 0.01 255);
  font: 600 12px/36px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  letter-spacing: -0.01em;
  cursor: pointer;
  box-shadow: 0 4px 16px oklch(62% 0.19 255 / 0.35);
}
.launcher:hover { background: oklch(56% 0.19 255); }
.launcher[hidden] { display: none; }
`;

export class PanelHost {
  private root: ShadowRoot;
  private readonly frameOrigin: string;
  private shell!: HTMLDivElement;
  private frame!: HTMLIFrameElement;
  private launcher!: HTMLButtonElement;
  private state: PanelState = { ...DEFAULT_PANEL };
  private ready = false;
  /** One queued message per type, so a theme change cannot drop a snapshot. */
  private pending = new Map<string, ToPanel>();
  private saveTimer: number | undefined;
  /** Resolves once stored geometry has been applied. */
  readonly restored: Promise<void>;

  constructor(private frameUrl: string) {
    const frameLocation = new URL(frameUrl);
    this.frameOrigin = `${frameLocation.protocol}//${frameLocation.host}`;
    const existing = document.getElementById(HOST_ID);
    existing?.remove();

    const host = document.createElement("div");
    host.id = HOST_ID;
    // `all: initial` on the host keeps LeetCode's cascade from reaching in.
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
    this.frame.setAttribute("title", "Graphy visualizer");
    this.shell.appendChild(this.frame);

    this.launcher = document.createElement("button");
    this.launcher.className = "launcher";
    this.launcher.textContent = "Graphy";
    this.launcher.addEventListener("click", () => this.open());

    this.root.append(style, this.shell, this.launcher);
    window.addEventListener("message", this.onMessage);
    window.addEventListener("resize", this.clamp);

    const state = await loadPanelState();
    this.state = state;
    if (state.x < 0 || state.y < 0) this.placeDefault();
    this.apply();
  }

  private placeDefault(): void {
    this.state.x = Math.max(16, window.innerWidth - this.state.width - 24);
    this.state.y = Math.max(16, window.innerHeight - this.state.height - 24);
  }

  private apply(): void {
    const height = this.state.collapsed ? COLLAPSED_HEIGHT : this.state.height;
    Object.assign(this.shell.style, {
      left: `${this.state.x}px`,
      top: `${this.state.y}px`,
      width: `${this.state.width}px`,
      height: `${height}px`,
    });
    this.shell.dataset.open = String(this.state.open);
    this.launcher.hidden = this.state.open;
  }

  private clamp = (): void => {
    this.state.x = Math.min(Math.max(0, this.state.x), Math.max(0, window.innerWidth - 80));
    this.state.y = Math.min(Math.max(0, this.state.y), Math.max(0, window.innerHeight - 40));
    this.apply();
  };

  private persist(): void {
    window.clearTimeout(this.saveTimer);
    this.saveTimer = window.setTimeout(() => void savePanelState(this.state), 400);
  }

  open(): void {
    this.state.open = true;
    this.state.collapsed = false;
    this.apply();
    this.persist();
  }

  get isOpen(): boolean {
    return this.state.open;
  }

  toggle(): void {
    if (this.state.open) this.close();
    else this.open();
  }

  close(): void {
    this.state.open = false;
    this.apply();
    this.persist();
  }

  /** Queues until the panel signals ready, so the first snapshot is never lost. */
  send(message: ToPanel): void {
    if (!this.ready) {
      this.pending.set(message.type, message);
      return;
    }
    this.frame.contentWindow?.postMessage(message, this.frameOrigin);
  }

  destroy(): void {
    window.removeEventListener("message", this.onMessage);
    window.removeEventListener("resize", this.clamp);
    document.getElementById(HOST_ID)?.remove();
  }

  private onMessage = (event: MessageEvent): void => {
    if (event.source !== this.frame.contentWindow) return;
    if (event.origin !== this.frameOrigin) return;
    const data: unknown = event.data;
    if (!isPanelMessage(data)) return;

    switch (data.type) {
      case "ready": {
        this.ready = true;
        const queued = [...this.pending.values()];
        this.pending.clear();
        for (const message of queued) this.send(message);
        break;
      }
      case "close":
        this.close();
        break;
      case "collapse":
        this.state.collapsed = data.collapsed;
        this.apply();
        this.persist();
        break;
      case "move":
        this.state.x += data.dx;
        this.state.y += data.dy;
        this.clamp();
        break;
      case "resize":
        this.state.width = Math.max(MIN_WIDTH, this.state.width + data.dx);
        this.state.height = Math.max(MIN_HEIGHT, this.state.height + data.dy);
        this.apply();
        break;
      case "persist":
        this.persist();
        break;
    }
  };
}
