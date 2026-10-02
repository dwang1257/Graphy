import { installChromeShim } from "./chromeShim.js";
import { SAMPLES, isSampleName, type SampleName } from "./samples.js";
import { PANEL_CHANNEL, isPanelMessage, type FromPanel, type Snapshot, type ToPanel } from "../src/shared/protocol.js";
import type { ThemeMode } from "../src/settings/schema.js";
import {
  DEFAULT_PANEL,
  loadPanelState,
  loadSettings,
  onSettingsChanged,
  savePanelState,
  saveSettings,
  type PanelState,
} from "../src/settings/storage.js";
import {
  SHRINK_EASE,
  SHRINK_MS,
  applyShellStyles,
  clampPanelBox,
  clipAnimation,
  shellClipPath,
} from "../src/content/shellLayout.js";
import { queuePanelMessage } from "../src/content/host.js";

installChromeShim();

type LogEntry = { at: number; direction: "in" | "out"; message: FromPanel | ToPanel };

const SIZES: Array<[number, number]> = [
  [280, 420],
  [460, 520],
  [720, 900],
];
const MARGIN = 16;

function element<T extends HTMLElement>(id: string, type: new () => T): T {
  const found = document.getElementById(id);
  if (!(found instanceof type)) throw new Error(`Missing #${id}`);
  return found;
}

const bar = element("bar", HTMLElement);
const shell = element("shell", HTMLDivElement);
const frame = element("panel", HTMLIFrameElement);
const launcher = element("launcher", HTMLButtonElement);
const status = element("status", HTMLDivElement);
const logList = element("log", HTMLOListElement);

const log: LogEntry[] = [];
const pending = new Map<string, ToPanel>();
let lastContent: ToPanel | null = null;
let ready = false;
let readyWaiters: Array<() => void> = [];
let state: PanelState = { ...DEFAULT_PANEL, open: true };
let clip: Animation | undefined;
let mode: ThemeMode = "dark";
let activeSample: SampleName | null = null;

function record(direction: LogEntry["direction"], message: FromPanel | ToPanel): void {
  log.push({ at: Date.now(), direction, message });
  if (log.length > 200) log.shift();
  const item = document.createElement("li");
  item.className = direction;
  const detail = message.type === "snapshot" ? message.payload.slug : JSON.stringify({ ...message, channel: undefined });
  item.textContent = `${direction === "in" ? "<-" : "->"} ${message.type} ${detail}`;
  logList.prepend(item);
  while (logList.children.length > 50) logList.lastElementChild?.remove();
}

function topInset(): number {
  return bar.getBoundingClientRect().bottom;
}

function clamp(): void {
  const top = topInset();
  const box = clampPanelBox(
    { x: state.x, y: state.y - top, width: state.width, height: state.height },
    { width: window.innerWidth, height: window.innerHeight - top },
  );
  state = { ...state, x: box.x, y: box.y + top };
}

function paint(settle: boolean, clipPath?: string): void {
  applyShellStyles(shell, frame, state, { settle, clipPath });
  launcher.hidden = state.open;
  renderStatus();
}

function apply(): void {
  clip?.cancel();
  clip = undefined;
  paint(state.shrunk);
}

function persist(): void {
  void savePanelState(state);
}

function renderStatus(): void {
  status.dataset.ready = String(ready);
  const flags = [state.shrunk ? "shrunk" : "", state.open ? "" : "closed"].filter(Boolean).join(" ");
  status.textContent = `${ready ? "ready" : "waiting"} · ${state.width}×${state.height}${flags ? ` · ${flags}` : ""}`;
  for (const button of bar.querySelectorAll<HTMLButtonElement>("button[data-size]")) {
    button.setAttribute("aria-pressed", String(button.dataset.size === `${state.width}x${state.height}`));
  }
  for (const button of bar.querySelectorAll<HTMLButtonElement>("button[data-sample]")) {
    button.setAttribute("aria-pressed", String(button.dataset.sample === activeSample));
  }
  const shrinkButton = bar.querySelector<HTMLButtonElement>("button[data-action=shrink]");
  shrinkButton?.setAttribute("aria-pressed", String(state.shrunk));
  const modeButton = bar.querySelector<HTMLButtonElement>("button[data-action=mode]");
  if (modeButton) modeButton.textContent = `Theme: ${mode}`;
  const pageButton = bar.querySelector<HTMLButtonElement>("button[data-action=page]");
  if (pageButton) pageButton.textContent = `Page: ${document.documentElement.dataset.page ?? "light"}`;
  const logButton = bar.querySelector<HTMLButtonElement>("button[data-action=log]");
  logButton?.setAttribute("aria-pressed", String(!logList.hidden));
}

function post(message: ToPanel): void {
  if (message.type !== "shrunk") lastContent = message;
  if (!ready) {
    queuePanelMessage(pending, message);
    return;
  }
  record("out", message);
  frame.contentWindow?.postMessage(message, location.origin);
}

function setShrunk(shrunk: boolean): void {
  if (state.shrunk === shrunk) {
    post({ channel: PANEL_CHANNEL, type: "shrunk", shrunk });
    return;
  }
  const from = shellClipPath(state.height, !shrunk);
  const to = shellClipPath(state.height, shrunk);
  state = { ...state, shrunk };
  clip?.cancel();
  paint(false, from);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  clip = shell.animate(clipAnimation(from, to), { duration: reduce ? 0 : SHRINK_MS, easing: SHRINK_EASE, fill: "forwards" });
  clip.onfinish = () => {
    clip?.cancel();
    if (state.shrunk === shrunk) paint(state.shrunk);
  };
  post({ channel: PANEL_CHANNEL, type: "shrunk", shrunk });
  persist();
}

function resize(width: number, height: number): void {
  state = { ...state, width, height };
  clamp();
  apply();
  persist();
}

function setOpen(open: boolean): void {
  state = { ...state, open };
  if (open && !frame.getAttribute("src")) frame.src = "/harness/panel.html";
  apply();
  persist();
}

function reloadPanel(): void {
  ready = false;
  pending.clear();
  if (lastContent) queuePanelMessage(pending, lastContent);
  renderStatus();
  frame.src = "/harness/panel.html";
}

function setActiveSample(name: SampleName | null): void {
  activeSample = name;
  const url = new URL(location.href);
  if (name) url.searchParams.set("sample", name);
  else url.searchParams.delete("sample");
  history.replaceState(null, "", url);
}

function sendSnapshot(input: SampleName | Snapshot): Snapshot {
  const payload = typeof input === "string" ? SAMPLES[input].build() : input;
  setActiveSample(typeof input === "string" ? input : null);
  post({ channel: PANEL_CHANNEL, type: "snapshot", payload });
  renderStatus();
  return payload;
}

function clear(): void {
  setActiveSample(null);
  post({ channel: PANEL_CHANNEL, type: "clear" });
  renderStatus();
}

async function setPanelMode(next: ThemeMode): Promise<void> {
  const settings = await loadSettings();
  await saveSettings({ ...settings, mode: next });
  mode = next;
  renderStatus();
}

function setPage(theme: "light" | "dark"): void {
  document.documentElement.dataset.page = theme;
  try {
    localStorage.setItem("graphyHarness:page", theme);
  } catch {}
  renderStatus();
}

async function resetStorage(): Promise<void> {
  await Promise.all([chrome.storage.sync.clear(), chrome.storage.local.clear()]);
  mode = (await loadSettings()).mode;
  state = { ...DEFAULT_PANEL, open: true, x: MARGIN, y: topInset() + MARGIN };
  apply();
  reloadPanel();
}

function whenReady(): Promise<void> {
  if (ready) return Promise.resolve();
  return new Promise((resolvePromise) => readyWaiters.push(resolvePromise));
}

window.addEventListener("message", (event) => {
  if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
  const data: unknown = event.data;
  if (!isPanelMessage(data)) return;
  record("in", data);
  switch (data.type) {
    case "ready": {
      ready = true;
      const queued = [...pending.values()];
      pending.clear();
      for (const message of queued) post(message);
      post({ channel: PANEL_CHANNEL, type: "shrunk", shrunk: state.shrunk });
      for (const resolveWaiter of readyWaiters) resolveWaiter();
      readyWaiters = [];
      renderStatus();
      break;
    }
    case "close":
      setOpen(false);
      break;
    case "move":
      state = { ...state, x: state.x + data.dx, y: state.y + data.dy };
      clamp();
      apply();
      break;
    case "persist":
      persist();
      break;
    case "setShrunk":
      setShrunk(data.shrunk);
      break;
  }
});

function button(parentId: string, label: string, onClick: () => void, data: Record<string, string>): void {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  Object.assign(node.dataset, data);
  node.addEventListener("click", onClick);
  element(parentId, HTMLDivElement).append(node);
}

for (const [width, height] of SIZES) {
  button("sizes", `${width}×${height}`, () => resize(width, height), { size: `${width}x${height}` });
}
for (const [name, sample] of Object.entries(SAMPLES)) {
  if (isSampleName(name)) button("samples", sample.label, () => sendSnapshot(name), { sample: name });
}
button("samples", "Clear", clear, { action: "clear" });
button("actions", "Shrink", () => setShrunk(!state.shrunk), { action: "shrink" });
button("actions", "Theme", () => void setPanelMode(mode === "dark" ? "light" : "dark"), { action: "mode" });
button("actions", "Page", () => setPage(document.documentElement.dataset.page === "dark" ? "light" : "dark"), { action: "page" });
button("actions", "Reload", reloadPanel, { action: "reload" });
button("actions", "Reset storage", () => void resetStorage(), { action: "reset" });
button("actions", "Log", () => {
  logList.hidden = !logList.hidden;
  renderStatus();
}, { action: "log" });
launcher.addEventListener("click", () => setOpen(true));
window.addEventListener("resize", () => {
  clamp();
  apply();
});

const harness = {
  samples: Object.keys(SAMPLES) as SampleName[],
  sendSnapshot,
  clear,
  resize,
  setShrunk,
  open: () => setOpen(true),
  close: () => setOpen(false),
  setPanelMode,
  setPage,
  reloadPanel,
  resetStorage,
  whenReady,
  get ready() {
    return ready;
  },
  get state(): PanelState {
    return { ...state };
  },
  get messages(): LogEntry[] {
    return [...log];
  },
  get frame(): HTMLIFrameElement {
    return frame;
  },
  get panelDocument(): Document | null {
    return frame.contentDocument;
  },
};

declare global {
  interface Window {
    graphyHarness: typeof harness;
  }
}

window.graphyHarness = harness;

try {
  const page = localStorage.getItem("graphyHarness:page");
  document.documentElement.dataset.page = page === "dark" ? "dark" : "light";
} catch {
  document.documentElement.dataset.page = "light";
}

const [stored, settings] = await Promise.all([loadPanelState(), loadSettings()]);
let current = settings;
mode = current.mode;
onSettingsChanged((update) => {
  current = update(current);
  mode = current.mode;
  renderStatus();
});
const fresh = stored.x < 0 || stored.y < 0;
state = { ...stored, open: true, x: fresh ? MARGIN : stored.x, y: fresh ? topInset() + MARGIN : stored.y };
clamp();
setOpen(true);
const initial = new URL(location.href).searchParams.get("sample") ?? "tree";
if (isSampleName(initial)) sendSnapshot(initial);
