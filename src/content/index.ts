import { PANEL_CHANNEL, isPageMessage, type Snapshot } from "../shared/protocol.js";
import { loadAutoOpen } from "../settings/storage.js";
import { PanelHost } from "./host.js";
import { notifyPageHooks, notifyPageTrace } from "./pageTrace.js";

const PROBLEM_PATH = /^\/problems\/[^/]+/;

let host: PanelHost | null = null;
let pageScript: "absent" | "loading" | "loaded" = "absent";
let pageWorkEnabled = false;

function notifyPageWork(): void {
  notifyPageTrace(pageWorkEnabled);
  notifyPageHooks(pageWorkEnabled);
}

function injectPageScript(): void {
  pageScript = "loading";
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("injected.js");
  script.async = false;
  script.addEventListener("load", () => {
    script.remove();
    pageScript = "loaded";
    notifyPageWork();
  });
  (document.head ?? document.documentElement).prepend(script);
}

function setPageWork(enabled: boolean): void {
  pageWorkEnabled = enabled;
  if (pageScript === "loaded") notifyPageWork();
  else if (pageScript === "absent" && enabled) injectPageScript();
}

function onProblemPage(): boolean {
  return PROBLEM_PATH.test(location.pathname);
}

function syncPageWork(): void {
  setPageWork(host?.isOpen === true);
}

function mount(): void {
  if (host) return;
  const created = new PanelHost(chrome.runtime.getURL("src/panel/index.html"), { onOpenChange: syncPageWork });
  host = created;
  void Promise.all([created.restored, loadAutoOpen()]).then(([, autoOpen]) => {
    if (host !== created) return;
    if (autoOpen && !created.isOpen) created.open();
    syncPageWork();
  });
}

function unmount(): void {
  setPageWork(false);
  host?.destroy();
  host = null;
}

function forward(snapshot: Snapshot): void {
  if (!host?.isOpen) return;
  host.send({ channel: PANEL_CHANNEL, type: "snapshot", payload: snapshot });
}

function clearPanel(): void {
  host?.send({ channel: PANEL_CHANNEL, type: "clear" });
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.origin !== location.origin) return;
  const data: unknown = event.data;
  if (!isPageMessage(data)) return;
  if (data.type === "clear") clearPanel();
  else forward(data.payload);
});

chrome.runtime.onMessage.addListener((message: { type?: string }) => {
  if (message?.type !== "graphy:toggle") return;
  if (!host) mount();
  else host.toggle();
});

function watchNavigation(): void {
  let path = location.pathname;
  navigation.addEventListener("currententrychange", () => {
    if (location.pathname === path) return;
    path = location.pathname;
    if (onProblemPage()) {
      mount();
      syncPageWork();
    } else {
      clearPanel();
      unmount();
    }
  });
}

function start(): void {
  if (onProblemPage()) mount();
  watchNavigation();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", start, { once: true });
} else {
  start();
}
