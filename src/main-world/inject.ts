import { PAGE_CHANNEL, type Snapshot } from "../shared/protocol.js";
import { captureCasesFromTabs } from "./testcaseCapture.js";
import { createTestcaseDomAdapter, type TestcaseDomAdapter } from "./testcaseDom.js";

/**
 * Runs in the page world. Case tabs are visited one at a time through the DOM
 * adapter; Graphy publishes only a complete collection. The Run request is a
 * one-case fallback when no tabs and no complete cache exist.
 */

interface CMNode extends HTMLElement {
  cmView?: { rootView?: { view?: { state?: { doc?: { toString(): string } } } } };
}

const CODE_HINTS = /class\s+Solution|def\s+\w+\s*\(|func\s+\w+|impl\s+Solution|var\s+\w+\s*=\s*function|public\s+class|^\s*(?:int|char|void|double|bool|struct)\b[^=\n]*\(/m;

const rawAdapter = createTestcaseDomAdapter(document, window);
let suppressClick = false;
const adapter: TestcaseDomAdapter = {
  ...rawAdapter,
  select: (tab) => {
    suppressClick = true;
    try {
      rawAdapter.select(tab);
    } finally {
      suppressClick = false;
    }
  },
};

let last = "";
let generation = 0;
let timer: number | undefined;
let cache: { slug: string; cases: string[] } | null = null;

function docOf(content: CMNode): string | null {
  const view = content.cmView?.rootView?.view;
  const text = view?.state?.doc?.toString();
  return typeof text === "string" ? text : null;
}

/** Solution text only. Testcase editors are collected by the tab adapter. */
function captureCode(): string {
  for (const el of document.querySelectorAll<CMNode>(".cm-content")) {
    const text = docOf(el);
    if (text !== null && CODE_HINTS.test(text)) return text;
  }
  return "";
}

function slugOf(): string {
  return location.pathname.match(/\/problems\/([^/]+)/)?.[1] ?? "";
}

function langOf(): string {
  try {
    const raw = localStorage.getItem("global_lang");
    if (raw) return JSON.parse(raw) as string;
  } catch {
    /* Falls through to the DOM probe. */
  }
  const button = document.querySelector<HTMLElement>("[id^='headlessui-listbox-button'], button[data-state]");
  return (button?.textContent ?? "").trim().toLowerCase().replace(/[^a-z0-9+#]/g, "") || "cpp";
}

function post(snapshot: Snapshot): void {
  window.postMessage({ channel: PAGE_CHANNEL, type: "snapshot", payload: snapshot }, location.origin);
}

function beginGeneration(): number {
  generation += 1;
  return generation;
}

async function publish(source: Snapshot["source"], override?: Partial<Snapshot>): Promise<void> {
  const slug = slugOf();
  if (!slug) return;

  const gen = beginGeneration();
  const isCurrent = () => gen === generation;
  const fromDom = await captureCasesFromTabs(adapter, isCurrent);
  if (!isCurrent()) return;

  if (cache && cache.slug !== slug) cache = null;

  let cases = fromDom.cases;
  let captureError = fromDom.captureError;

  if (captureError) {
    if (cache && cache.cases.length > 0) {
      cases = cache.cases;
      captureError = undefined;
    } else {
      cases = [];
    }
  } else if (cases.length > 0) {
    cache = { slug, cases };
  }

  if (source === "network") {
    const runCases = override?.cases;
    const noTabs = adapter.tabs().length === 0;
    const noCache = !cache || cache.cases.length === 0;
    if (noTabs && noCache && runCases && runCases.length > 0) {
      cases = runCases;
      captureError = undefined;
    }
  }

  const snapshot: Snapshot = {
    cases,
    code: override?.code ?? captureCode(),
    lang: override?.lang ?? langOf(),
    slug,
    source,
    at: Date.now(),
  };
  if (captureError) snapshot.captureError = captureError;

  const key = `${snapshot.cases.join("\u001f")}\u001e${snapshot.code}\u001e${snapshot.lang}\u001e${snapshot.captureError ?? ""}`;
  if (source === "editor" && key === last) return;
  last = key;
  post(snapshot);
}

function schedule(): void {
  if (suppressClick) return;
  beginGeneration();
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    void publish("editor");
  }, 250);
}

/** Reads `data_input` out of a Run request - exactly what LeetCode will execute. */
function fromRunBody(body: unknown): Partial<Snapshot> | null {
  if (typeof body !== "string") return null;
  try {
    const parsed = JSON.parse(body) as Record<string, unknown>;
    if (typeof parsed.data_input !== "string") return null;
    return {
      cases: [parsed.data_input],
      code: typeof parsed.typed_code === "string" ? parsed.typed_code : undefined,
      lang: typeof parsed.lang === "string" ? parsed.lang : undefined,
    };
  } catch {
    return null;
  }
}

const RUN_URL = /\/interpret_solution\/?$|\/interpret_solution\//;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function patchNetwork(): void {
  const nativeFetch = window.fetch;
  window.fetch = function patched(this: typeof globalThis, input: RequestInfo | URL, init?: RequestInit) {
    try {
      if (RUN_URL.test(requestUrl(input))) {
        void publish("network", fromRunBody(init?.body) ?? undefined);
      }
    } catch {
      /* Never let instrumentation break the page's own request. */
    }
    return nativeFetch.call(this, input as RequestInfo, init);
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  const urls = new WeakMap<XMLHttpRequest, string>();

  XMLHttpRequest.prototype.open = function open(this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    urls.set(this, String(url));
    return (nativeOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.send = function send(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    try {
      if (RUN_URL.test(urls.get(this) ?? "")) {
        void publish("network", fromRunBody(body) ?? undefined);
      }
    } catch {
      /* Same - instrumentation must never be fatal. */
    }
    return nativeSend.call(this, body ?? null);
  };
}

patchNetwork();
document.addEventListener("input", schedule, true);
document.addEventListener("paste", schedule, true);
document.addEventListener("click", schedule, true);
window.setInterval(() => {
  void publish("editor");
}, 1500);
void publish("editor");
