import {
  PAGE_CHANNEL,
  isPageControlMessage,
  pageClearMessage,
  type Snapshot,
} from "../shared/protocol.js";
import { instrumentRunBody } from "./instrument.js";
import { extractRunStdout, extractRunStdoutByCase } from "./runResult.js";
import { captureCasesFromTabs, captureCasesWhenReady } from "./testcaseCapture.js";
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
let tracingEnabled = false;
let hooksActive = false;
let activeSlug = "";

function onPageMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  if (event.origin !== location.origin) return;
  if (!isPageControlMessage(event.data)) return;
  if (event.data.type === "trace") {
    tracingEnabled = event.data.enabled;
    return;
  }
  setHooksActive(event.data.enabled);
}

window.addEventListener("message", onPageMessage);

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
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === "string") return parsed;
    }
  } catch {
    /* Falls through to the DOM probe. */
  }
  const button = document.querySelector<HTMLElement>("[id^='headlessui-listbox-button'], button[data-state]");
  return (button?.textContent ?? "").trim().toLowerCase().replace(/[^a-z0-9+#]/g, "") || "cpp";
}

function post(snapshot: Snapshot): void {
  window.postMessage({ channel: PAGE_CHANNEL, type: "snapshot", payload: snapshot }, location.origin);
}

function postClear(): void {
  window.postMessage(pageClearMessage(), location.origin);
}

function beginGeneration(): number {
  generation += 1;
  return generation;
}

function publish(
  source: Snapshot["source"],
  override?: Partial<Snapshot>,
  walk = false,
  waitForReady = false,
  preserveGeneration = false,
): Promise<void> {
  const slug = slugOf();
  if (!slug) return Promise.resolve();

  const gen = preserveGeneration ? generation : beginGeneration();
  const queued = flight.then(async () => {
    if (gen !== generation) return;
    if (!hooksActive || activeSlug !== slug) return;

    const isCurrent = () => gen === generation;
    if (cache && cache.slug !== slug) cache = null;

    let cases: string[] = cache?.cases ?? [];
    let captureError: string | undefined;

    if (walk) {
      const fromDom = waitForReady
        ? await captureCasesWhenReady(adapter, isCurrent)
        : await captureCasesFromTabs(adapter, isCurrent);
      if (!isCurrent()) return;
      const liveSlug = slugOf();
      if (!liveSlug || liveSlug !== slug) return;
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

    if (source === "editor" && cases.length === 0 && !captureError) return;

    const snapshot: Snapshot = {
      cases,
      code: override?.code ?? captureCode(),
      lang: override?.lang ?? langOf(),
      slug,
      source,
      at: Date.now(),
    };
    if (captureError) snapshot.captureError = captureError;
    if (override?.stdout !== undefined) snapshot.stdout = override.stdout;
    if (override?.stdoutByCase !== undefined) snapshot.stdoutByCase = override.stdoutByCase;

    const key = `${snapshot.cases.join("\u001f")}\u001e${snapshot.code}\u001e${snapshot.lang}\u001e${snapshot.captureError ?? ""}`;
    if (source === "editor" && key === last) return;
    last = key;
    post(snapshot);
  });
  flight = queued.then(() => undefined, () => undefined);
  return flight;
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
const MAX_PENDING_RUNS = 32;

interface PendingRun {
  override?: Partial<Snapshot>;
  sequence: number;
}

let nextRunSequence = 0;
const pendingRuns = new Map<number, PendingRun>();
const pendingResults = new Map<string, PendingRun>();

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

function dropOldestPending(): void {
  let oldest: { map: Map<unknown, PendingRun>; key: unknown; sequence: number } | undefined;
  for (const [key, pending] of pendingRuns) {
    if (!oldest || pending.sequence < oldest.sequence) {
      oldest = { map: pendingRuns, key, sequence: pending.sequence };
    }
  }
  for (const [key, pending] of pendingResults) {
    if (!oldest || pending.sequence < oldest.sequence) {
      oldest = { map: pendingResults, key, sequence: pending.sequence };
    }
  }
  if (oldest) oldest.map.delete(oldest.key);
}

function trimPending(): void {
  while (pendingRuns.size + pendingResults.size > MAX_PENDING_RUNS) dropOldestPending();
}

function clearPending(): void {
  pendingRuns.clear();
  pendingResults.clear();
}

function rememberRun(body: unknown): number {
  const sequence = nextRunSequence;
  nextRunSequence += 1;
  pendingRuns.set(sequence, { override: fromRunBody(body) ?? undefined, sequence });
  trimPending();
  return sequence;
}

function rememberInterpretId(body: Record<string, unknown> | null, sequence: number): void {
  const id = interpretIdOf(body);
  const pending = pendingRuns.get(sequence);
  if (!pending) return;
  pendingRuns.delete(sequence);
  if (!id) return;
  pendingResults.set(id, pending);
  trimPending();
}

function maybeWalkResults(url: string, body: Record<string, unknown> | null): void {
  const state = body?.state;
  if (typeof state !== "string" || IN_FLIGHT.has(state)) return;
  const checkId = CHECK_URL.exec(url)?.[1];
  if (!checkId) return;
  const pending = pendingResults.get(checkId);
  if (!pending) return;

  const override: Partial<Snapshot> = { ...pending.override };
  const stdout = extractRunStdout(body);
  if (stdout !== undefined) override.stdout = stdout;
  const stdoutByCase = extractRunStdoutByCase(body);
  if (stdoutByCase !== undefined) override.stdoutByCase = stdoutByCase;
  pendingResults.delete(checkId);
  void publish("network", override, true, false, true);
}

function outgoingRun(body: unknown): { remember: unknown; send: unknown } {
  const rewritten = tracingEnabled ? instrumentRunBody(body) : null;
  return {
    remember: body,
    send: rewritten ? rewritten.body : body,
  };
}

let networkPatched = false;
let nativeFetch: typeof window.fetch;
let nativeOpen: typeof XMLHttpRequest.prototype.open;
let nativeSend: typeof XMLHttpRequest.prototype.send;
let xhrUrls = new WeakMap<XMLHttpRequest, string>();

function patchNetwork(): void {
  if (networkPatched) return;
  nativeFetch = window.fetch;
  window.fetch = function patched(this: typeof globalThis, input: RequestInfo | URL, init?: RequestInit) {
    if (!hooksActive) return nativeFetch.call(this, input, init);
    const url = requestUrl(input);
    let nextInit = init;
    let sequence: number | undefined;
    try {
      if (RUN_URL.test(url)) {
        const run = outgoingRun(init?.body);
        sequence = rememberRun(run.remember);
        if (run.send !== init?.body && init) {
          nextInit = { ...init, body: run.send as BodyInit };
        }
      }
    } catch {
      /* Never let instrumentation break the page's own request. */
    }

    const request = nativeFetch.call(this, input as RequestInfo, nextInit);
    void request
      .then(async (response) => {
        if (RUN_URL.test(url)) {
          if (sequence !== undefined) rememberInterpretId(await readResponseJson(response), sequence);
          return;
        }
        if (CHECK_URL.test(url)) maybeWalkResults(url, await readResponseJson(response));
      })
      .catch(() => undefined);
    return request;
  };

  nativeOpen = XMLHttpRequest.prototype.open;
  nativeSend = XMLHttpRequest.prototype.send;
  xhrUrls = new WeakMap<XMLHttpRequest, string>();

  XMLHttpRequest.prototype.open = function open(this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    xhrUrls.set(this, String(url));
    return (nativeOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.send = function send(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    if (!hooksActive) return nativeSend.call(this, body);
    const url = xhrUrls.get(this) ?? "";
    let nextBody = body;
    let sequence: number | undefined;
    try {
      if (RUN_URL.test(url)) {
        const run = outgoingRun(body);
        sequence = rememberRun(run.remember);
        nextBody = run.send as typeof body;
      }
    } catch {
      /* Same - instrumentation must never be fatal. */
    }

    if (RUN_URL.test(url) || CHECK_URL.test(url)) {
      this.addEventListener("load", () => {
        try {
          const parsed = parseObject(String(this.responseText ?? ""));
          if (RUN_URL.test(url) && sequence !== undefined) rememberInterpretId(parsed, sequence);
          else maybeWalkResults(url, parsed);
        } catch {
          /* Same - instrumentation must never be fatal. */
        }
      }, { once: true });
    }
    return nativeSend.call(this, nextBody ?? null);
  };
  networkPatched = true;
}

function unpatchNetwork(): void {
  if (!networkPatched) return;
  window.fetch = nativeFetch;
  XMLHttpRequest.prototype.open = nativeOpen;
  XMLHttpRequest.prototype.send = nativeSend;
  networkPatched = false;
}

function setHooksActive(enabled: boolean): void {
  const slug = slugOf();
  if (enabled) {
    if (!slug) return;
    if (hooksActive && activeSlug === slug) return;
    const changedSlug = activeSlug !== "" && activeSlug !== slug;
    hooksActive = true;
    activeSlug = slug;
    beginGeneration();
    last = "";
    cache = null;
    clearPending();
    patchNetwork();
    if (changedSlug) postClear();
    void publish("editor", undefined, true, true);
    return;
  }

  if (!hooksActive && activeSlug === "") return;
  hooksActive = false;
  activeSlug = "";
  beginGeneration();
  last = "";
  cache = null;
  clearPending();
  unpatchNetwork();
  postClear();
}
