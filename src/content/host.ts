import { isPanelMessage, type ToPanel } from "../shared/protocol.js";
import { DEFAULT_PANEL, loadPanelState, savePanelState, type PanelState } from "../settings/storage.js";

const HOST_ID = "graphy-root";

const STYLE = `
:host {
  all: initial;
  --color-paper: oklch(99% 0.004 250);
  --color-ink: oklch(22% 0.02 255);
  --color-accent: oklch(62% 0.19 255);
  --color-accent-ink: oklch(99% 0.01 255);
  --color-rule: oklch(84% 0.012 250);
  --color-focus: oklch(62% 0.19 255);
  --font-body: "Outfit", ui-sans-serif, system-ui, sans-serif;
}
.shell {
  position: fixed;
  z-index: 2147483646;
  border: 0;
  border-radius: 0;
  overflow: hidden;
  box-shadow: none;
  background: transparent;
  display: none;
}
.shell[data-open="true"] { display: block; }
.shell iframe { width: 100%; height: 100%; border: 0; display: block; }
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
  cursor: pointer;
  box-shadow: none;
}
.launcher:hover { background: var(--color-ink); border-color: var(--color-ink); color: var(--color-paper); }
.launcher:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 2px; }
.launcher:active { transform: translateY(1px); }
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
  /** One queued message per type, so a later snapshot replaces an earlier one. */
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

    const fonts = document.createElement("link");
    fonts.rel = "stylesheet";
    fonts.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap";

    this.root.append(fonts, style, this.shell, this.launcher);
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
    Object.assign(this.shell.style, {
      left: `${this.state.x}px`,
      top: `${this.state.y}px`,
      width: `${this.state.width}px`,
      height: `${this.state.height}px`,
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
      case "move":
        this.state.x += data.dx;
        this.state.y += data.dy;
        this.clamp();
        break;
      case "persist":
        this.persist();
        break;
    }
  };
}
