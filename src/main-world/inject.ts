import { PAGE_CHANNEL, type Snapshot } from "../shared/protocol.js";
import { captureCasesFromTabs } from "./testcaseCapture.js";
import { createTestcaseDomAdapter, type TestcaseDomAdapter } from "./testcaseDom.js";

/**
 * Runs in the page world. Case tabs are visited after a Run's check returns a
 * terminal state. The last complete cache is reused if that walk fails; a Run
 * may fall back to data_input only when no cache exists.
 */

interface CMNode extends HTMLElement {
  cmView?: { rootView?: { view?: { state?: { doc?: { toString(): string } } } } };
}

const CODE_HINTS = /class\s+Solution|def\s+\w+\s*\(|func\s+\w+|impl\s+Solution|var\s+\w+\s*=\s*function|public\s+class|^\s*(?:int|char|void|double|bool|struct)\b[^=\n]*\(/m;

const adapter: TestcaseDomAdapter = createTestcaseDomAdapter(document, window);

let last = "";
let generation = 0;
let cache: { slug: string; cases: string[] } | null = null;
let flight: Promise<void> = Promise.resolve();

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

function publish(source: Snapshot["source"], override?: Partial<Snapshot>, walk = false): void {
  const slug = slugOf();
  if (!slug) return;

  const gen = beginGeneration();
  const queued = flight.then(async () => {
    if (gen !== generation) return;

    const isCurrent = () => gen === generation;
    if (cache && cache.slug !== slug) cache = null;

    let cases: string[] = cache?.cases ?? [];
    let captureError: string | undefined;

    if (walk) {
      const fromDom = await captureCasesFromTabs(adapter, isCurrent);
      if (!isCurrent()) return;
      const liveSlug = slugOf();
      if (!liveSlug) return;
      if (cache && cache.slug !== liveSlug) cache = null;
      cases = fromDom.cases;
      captureError = fromDom.captureError;
      const completeCache = cache && cache.cases.length > 0 ? cache : null;
      if (captureError || cases.length === 0) {
        if (completeCache) {
          cases = completeCache.cases;
          captureError = undefined;
        } else if (captureError) {
          cases = [];
        }
      } else {
        cache = { slug: liveSlug, cases };
      }
    }

    if (source === "network") {
      const runCases = override?.cases;
      const noCache = !cache || cache.cases.length === 0;
      if (noCache && !captureError && runCases && runCases.length > 0) {
        cases = runCases;
      } else if (cache && cache.cases.length > 0) {
        cases = cache.cases;
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
  });
  flight = queued.then(() => undefined, () => undefined);
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
const CHECK_URL = /\/submissions\/detail\/([^/?]+)\/check\/?/;
const IN_FLIGHT = new Set(["PENDING", "STARTED"]);

interface PendingRun {
  override?: Partial<Snapshot>;
  id?: string;
}

let pendingRun: PendingRun | null = null;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function parseObject(text: string): Record<string, unknown> | null {
  try {
    return asObject(JSON.parse(text));
  } catch {
    return null;
  }
}

async function readResponseJson(response: Response): Promise<Record<string, unknown> | null> {
  try {
    return asObject(await response.clone().json());
  } catch {
    return null;
  }
}

function interpretIdOf(body: Record<string, unknown> | null): string | undefined {
  const id = body?.interpret_id;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

function rememberRun(body: unknown): void {
  pendingRun = { override: fromRunBody(body) ?? undefined };
}

function rememberInterpretId(body: Record<string, unknown> | null): void {
  const id = interpretIdOf(body);
  if (id && pendingRun) pendingRun.id = id;
}

function maybeWalkResults(url: string, body: Record<string, unknown> | null): void {
  if (!pendingRun) return;
  const state = body?.state;
  if (typeof state !== "string" || IN_FLIGHT.has(state)) return;
  const checkId = CHECK_URL.exec(url)?.[1];
  if (pendingRun.id && checkId !== pendingRun.id) return;

  const override = pendingRun.override;
  pendingRun = null;
  void publish("network", override, true);
}

function patchNetwork(): void {
  const nativeFetch = window.fetch;
  window.fetch = function patched(this: typeof globalThis, input: RequestInfo | URL, init?: RequestInit) {
    const url = requestUrl(input);
    try {
      if (RUN_URL.test(url)) rememberRun(init?.body);
    } catch {
      /* Never let instrumentation break the page's own request. */
    }

    const request = nativeFetch.call(this, input as RequestInfo, init);
    void request
      .then(async (response) => {
        if (RUN_URL.test(url)) {
          rememberInterpretId(await readResponseJson(response));
          return;
        }
        if (CHECK_URL.test(url)) maybeWalkResults(url, await readResponseJson(response));
      })
      .catch(() => undefined);
    return request;
  };

  const nativeOpen = XMLHttpRequest.prototype.open;
  const nativeSend = XMLHttpRequest.prototype.send;
  const urls = new WeakMap<XMLHttpRequest, string>();

  XMLHttpRequest.prototype.open = function open(this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    urls.set(this, String(url));
    return (nativeOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.send = function send(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const url = urls.get(this) ?? "";
    try {
      if (RUN_URL.test(url)) rememberRun(body);
    } catch {
      /* Same - instrumentation must never be fatal. */
    }

    this.addEventListener("load", () => {
      try {
        const parsed = parseObject(String(this.responseText ?? ""));
        if (RUN_URL.test(url)) rememberInterpretId(parsed);
        else if (CHECK_URL.test(url)) maybeWalkResults(url, parsed);
      } catch {
        /* Same - instrumentation must never be fatal. */
      }
    });
    return nativeSend.call(this, body ?? null);
  };
}

patchNetwork();
