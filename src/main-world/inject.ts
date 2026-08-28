import { PAGE_CHANNEL, type Snapshot } from "../shared/protocol.js";

/**
 * Runs in the page world. CodeMirror 6 virtualizes its lines, so reading
 * `textContent` off the DOM silently truncates long test cases. Instead we reach
 * the EditorView through the `cmView` property CodeMirror hangs on its own DOM
 * nodes and read the full document. The Run request is intercepted as a second,
 * authoritative source.
 */

interface CMNode extends HTMLElement {
  cmView?: { rootView?: { view?: { state?: { doc?: { toString(): string } } } } };
}

interface Editor {
  el: CMNode;
  text: string;
}

const CODE_HINTS = /class\s+Solution|def\s+\w+\s*\(|func\s+\w+|impl\s+Solution|var\s+\w+\s*=\s*function|public\s+class|^\s*(?:int|char|void|double|bool|struct)\b[^=\n]*\(/m;

let last = "";
let timer: number | undefined;

function docOf(content: CMNode): string | null {
  const view = content.cmView?.rootView?.view;
  const text = view?.state?.doc?.toString();
  return typeof text === "string" ? text : null;
}

function editors(): Editor[] {
  const out: Editor[] = [];
  for (const el of document.querySelectorAll<CMNode>(".cm-content")) {
    const text = docOf(el);
    if (text !== null) out.push({ el, text });
  }
  return out;
}

/** Inactive LeetCode Case panels remain mounted but are hidden. */
function isActiveField(el: HTMLElement): boolean {
  if (el.closest("[hidden], [aria-hidden='true'], [data-state='inactive']")) return false;
  return el.getClientRects().length > 0;
}

/** The buffer that looks like source code; only active test fields become input. */
function splitBuffers(): { code: string; input: string } {
  const found = editors();
  let codeIndex = found.findIndex((e) => CODE_HINTS.test(e.text));
  if (codeIndex === -1 && found.length > 0) {
    // Longest buffer is almost always the solution; a single editor is the
    // solution with the testcase drawer collapsed.
    codeIndex = found.reduce((best, e, i) => (e.text.length > found[best]!.text.length ? i : best), 0);
  }

  const code = codeIndex >= 0 ? found[codeIndex]!.text : "";
  const inputs: string[] = [];
  for (const [i, entry] of found.entries()) {
    if (i !== codeIndex && isActiveField(entry.el)) inputs.push(entry.text);
  }

  // LeetCode can mirror a field as CodeMirror and a textarea; use one representation.
  if (inputs.length === 0) {
    for (const area of document.querySelectorAll<HTMLTextAreaElement>("textarea[data-cy], .lc-textarea textarea")) {
      if (area.value && isActiveField(area)) inputs.push(area.value);
    }
  }

  return { code, input: inputs.join("\n").trim() };
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

function publish(source: Snapshot["source"], override?: Partial<Snapshot>): void {
  const slug = slugOf();
  if (!slug) return;
  const { code, input } = splitBuffers();
  const snapshot: Snapshot = {
    input,
    code,
    lang: langOf(),
    slug,
    source,
    ...defined(override),
  };
  const key = `${snapshot.input}\u001e${snapshot.code}\u001e${snapshot.lang}`;
  if (source === "editor" && key === last) return;
  last = key;
  post(snapshot);
}

/** Spreading a partial with explicit `undefined` would blank good values. */
function defined(override?: Partial<Snapshot>): Partial<Snapshot> {
  if (!override) return {};
  return Object.fromEntries(Object.entries(override).filter(([, v]) => v !== undefined));
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
      input: parsed.data_input,
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
