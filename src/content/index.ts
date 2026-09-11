import { PANEL_CHANNEL, isPageMessage, type Snapshot } from "../shared/protocol.js";
import { loadSettings } from "../settings/storage.js";
import { PanelHost } from "./host.js";
import { notifyPageTrace } from "./pageTrace.js";

const PROBLEM_PATH = /^\/problems\/[^/]+/;

let host: PanelHost | null = null;
let lastSnapshot: Snapshot | null = null;

/**
 * The capture script must run in the page world to reach CodeMirror's view
 * instances and patch `fetch`, so it is injected as a real <script> tag rather
 * than declared as a content script.
 */
function injectPageScript(): void {
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected.js");
  script.async = false;
  script.addEventListener("load", () => script.remove());
  (document.head ?? document.documentElement).prepend(script);
}

function onProblemPage(): boolean {
  return PROBLEM_PATH.test(location.pathname);
}

function mount(): void {
  if (host) return;
  host = new PanelHost(chrome.runtime.getURL("src/panel/index.html"));
  if (lastSnapshot) forward(lastSnapshot);
  const created = host;
  void Promise.all([created.restored, loadSettings()]).then(([, settings]) => {
    if (host !== created) return;
    if (settings.autoOpen || created.isOpen) created.open();
    notifyPageTrace(created.isOpen);
  });
}

function unmount(): void {
  notifyPageTrace(false);
  host?.destroy();
  host = null;
}

function forward(snapshot: Snapshot): void {
  host?.send({ channel: PANEL_CHANNEL, type: "snapshot", payload: snapshot });
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  const data: unknown = event.data;
  if (!isPageMessage(data)) return;
  lastSnapshot = data.payload;
  forward(data.payload);
});

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type !== "graphy:toggle") return;
  if (!host) mount();
  else host.toggle();
});

// LeetCode is a client-routed SPA, so `document_start` fires only on hard loads.
function watchNavigation(): void {
  let path = location.pathname;
  const check = (): void => {
    if (location.pathname === path) return;
    path = location.pathname;
    lastSnapshot = null;
    if (onProblemPage()) mount();
    else unmount();
  };
  const patch = <K extends "pushState" | "replaceState">(key: K): void => {
    const native = history[key];
    history[key] = function wrapped(this: History, ...args: Parameters<History[K]>) {
      const result = (native as (...a: unknown[]) => unknown).apply(this, args);
      queueMicrotask(check);
      return result;
    } as History[K];
  };
  patch("pushState");
  patch("replaceState");
  window.addEventListener("popstate", check);
  window.setInterval(check, 1000);
}

function start(): void {
  if (onProblemPage()) mount();
  watchNavigation();
}

injectPageScript();
// Mounting waits for <body> so the injected host never disturbs hydration.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
