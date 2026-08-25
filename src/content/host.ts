import { PANEL_CHANNEL, isPanelMessage, type ToPanel } from "../shared/protocol.js";
import { DEFAULT_PANEL, loadPanelState, savePanelState, type PanelState } from "../settings/storage.js";

const HOST_ID = "graphy-root";
const COLLAPSED_HEIGHT = 42;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 220;

const STYLE = `
:host { all: initial; }
.shell {
  position: fixed;
  z-index: 2147483646;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(0, 0, 0, 0.08);
  background: #ffffff;
  transition: height 120ms ease;
  display: none;
}
.shell[data-open="true"] { display: block; }
.shell iframe { width: 100%; height: 100%; border: 0; display: block; }
.launcher {
  position: fixed;
  z-index: 2147483645;
  right: 20px;
  bottom: 20px;
  height: 40px;
  padding: 0 16px;
  border: 0;
  border-radius: 20px;
  background: #4f46e5;
  color: #ffffff;
  font: 600 13px/40px ui-sans-serif, system-ui, -apple-system, sans-serif;
  letter-spacing: 0.01em;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(79, 70, 229, 0.4);
}
.launcher:hover { background: #4338ca; }
.launcher[hidden] { display: none; }
`;

export class PanelHost {
  private root: ShadowRoot;
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
    const existing = document.getElementById(HOST_ID);
    existing?.remove();

    const host = document.createElement("div");
    host.id = HOST_ID;
    // `all: initial` on the host keeps LeetCode's cascade from reaching in.
    host.style.cssText = "all: initial; position: static;";
    this.root = host.attachShadow({ mode: "open" });
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
    this.frame.contentWindow?.postMessage(message, "*");
  }

  destroy(): void {
    window.removeEventListener("message", this.onMessage);
    window.removeEventListener("resize", this.clamp);
    document.getElementById(HOST_ID)?.remove();
  }

  private onMessage = (event: MessageEvent): void => {
    if (event.source !== this.frame.contentWindow) return;
    const data: unknown = event.data;
    if (!isPanelMessage(data) || data.channel !== PANEL_CHANNEL) return;

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
