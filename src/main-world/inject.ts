import { groupTestCases, pickCaseBuffers, type CaseCapture } from "../core/cases.js";
import { PAGE_CHANNEL, type Snapshot } from "../shared/protocol.js";

/**
 * Runs in the page world. CodeMirror 6 virtualizes its lines, so reading
 * `textContent` off the DOM silently truncates long test cases. Instead we reach
 * the EditorView through the `cmView` property CodeMirror hangs on its own DOM
 * nodes and read the full document. The Run request is a one-case fallback when
 * the full Case collection is unavailable.
 */

interface CMNode extends HTMLElement {
  cmView?: { rootView?: { view?: { state?: { doc?: { toString(): string } } } } };
}

const CODE_HINTS = /class\s+Solution|def\s+\w+\s*\(|func\s+\w+|impl\s+Solution|var\s+\w+\s*=\s*function|public\s+class|^\s*(?:int|char|void|double|bool|struct)\b[^=\n]*\(/m;

let last = "";
let lastCases: string[] = [];
let lastCode = "";
let lastSlug = "";
let timer: number | undefined;

function docOf(content: CMNode): string | null {
  const view = content.cmView?.rootView?.view;
  const text = view?.state?.doc?.toString();
  return typeof text === "string" ? text : null;
}

function isResultEditor(el: CMNode): boolean {
  return !!el.closest?.('[data-e2e-locator*="result"]');
}

interface DomCapture extends CaseCapture {
  code: string;
  buffer: string;
  caseTags: number;
  params: number;
  editorCount: number;
}

/**
 * Reads custom-testcase editors (never the Output/result pane), then splits
 * them into ordered cases for Graphy-owned tabs.
 */
function captureCases(): DomCapture {
  const found: Array<{ el: CMNode; text: string }> = [];
  for (const el of document.querySelectorAll<CMNode>(".cm-content")) {
    const text = docOf(el);
    if (text !== null) found.push({ el, text });
  }

  const codeIndex = found.findIndex((hit) => CODE_HINTS.test(hit.text));
  const code = codeIndex >= 0 ? found[codeIndex]!.text : "";
  const rest = found.filter((_, i) => i !== codeIndex);
  const testcaseHits = rest.filter((hit) => !isResultEditor(hit.el));

  const caseTags = document.querySelectorAll('[data-e2e-locator="console-testcase-tag"]').length;
  const params = document.querySelectorAll('[data-e2e-locator="console-testcase-input"]').length;

  let candidates = testcaseHits.map((hit) => hit.text);
  let textareaCount = 0;
  if (candidates.length === 0) {
    for (const area of document.querySelectorAll<HTMLTextAreaElement>("textarea[data-cy], .lc-textarea textarea")) {
      if (area.value) {
        candidates.push(area.value);
        textareaCount += 1;
      }
    }
  }

  const inputs = pickCaseBuffers(candidates, caseTags, params);
  const buffer = inputs.join("\n").trim();
  return {
    code,
    buffer,
    caseTags,
    params,
    editorCount: testcaseHits.length + textareaCount,
    ...groupTestCases(buffer, caseTags, params),
  };
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

function stabilizeCases(fromDom: DomCapture, cases: string[], captureError: string | undefined): {
  cases: string[];
  captureError: string | undefined;
} {
  if (fromDom.editorCount === 0 && lastCases.length > 0) {
    return { cases: lastCases, captureError: undefined };
  }
  if (
    lastCases.length > 1
    && lastCases.length === fromDom.caseTags
    && cases.length > 0
    && cases.length < lastCases.length
  ) {
    return { cases: lastCases, captureError: undefined };
  }
  return { cases, captureError };
}

function publish(source: Snapshot["source"], override?: Partial<Snapshot>): void {
  const slug = slugOf();
  if (!slug) return;
  if (slug !== lastSlug) {
    lastSlug = slug;
    lastCases = [];
    lastCode = "";
    last = "";
  }

  const fromDom = captureCases();
  let cases = fromDom.cases;
  let captureError = fromDom.captureError;

  if (source === "network") {
    const runCases = override?.cases;
    if (cases.length <= 1 || captureError) {
      if (lastCases.length > 1) {
        cases = lastCases;
        captureError = undefined;
      } else if (runCases && runCases.length > 0) {
        cases = runCases;
        captureError = undefined;
      }
    }
  }

  ({ cases, captureError } = stabilizeCases(fromDom, cases, captureError));

  const code = override?.code ?? (fromDom.code || lastCode);
  if (fromDom.code) lastCode = fromDom.code;

  const snapshot: Snapshot = {
    cases,
    code,
    lang: override?.lang ?? langOf(),
    slug,
    source,
    at: Date.now(),
  };
  if (captureError) snapshot.captureError = captureError;

  const key = `${snapshot.cases.join("\u001f")}\u001e${snapshot.code}\u001e${snapshot.lang}\u001e${snapshot.captureError ?? ""}`;
  if (source === "editor" && key === last) return;
  last = key;
  if (cases.length > 0 && (fromDom.editorCount > 0 || source === "network")) {
    if (fromDom.caseTags <= 1 || cases.length >= fromDom.caseTags) lastCases = cases;
  }
  post(snapshot);
}

function schedule(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => publish("editor"), 250);
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
        const captured = fromRunBody(init?.body);
        if (captured) publish("network", captured);
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
        const captured = fromRunBody(body);
        if (captured) publish("network", captured);
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
// CodeMirror mutations from undo, formatting, or route changes skip `input`.
window.setInterval(() => publish("editor"), 1500);
publish("editor");
