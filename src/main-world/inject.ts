import {
  MAX_CODE_LENGTH,
  MAX_LANG_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_SNAPSHOT_CASE_LENGTH,
  PAGE_CHANNEL,
  isPageControlMessage,
  pageClearMessage,
  type Snapshot,
  type SnapshotParam,
} from "../shared/protocol.js";
import { stripCheckBody } from "../core/traceWire.js";
import { instrumentRunBody } from "./instrument.js";
import {
  QUESTION_QUERY,
  editCacheKey,
  parseEditCache,
  parseQuestion,
  questionFromGraphql,
  questionFromNextData,
  splitDataInput,
  type QuestionData,
} from "./question.js";
import { extractRunStdout, extractRunStdoutByCase } from "./runResult.js";

interface CMNode extends HTMLElement {
  cmView?: { rootView?: { view?: { state?: { doc?: { toString(): string } } } } };
}

interface ProblemState {
  slug: string;
  lineCount: number | null;
  params?: SnapshotParam[];
  loaded: boolean;
  loading: boolean;
  queue: Promise<void>;
  snapshot: Snapshot | null;
  posted: Snapshot | null;
  latestRun: number;
}

interface RunRequest {
  dataInput: string;
  code?: string;
  lang?: string;
}

interface PendingRun {
  sequence: number;
  state: ProblemState;
  snapshot: Snapshot | null;
}

const CODE_HINTS = /class\s+Solution|def\s+\w+\s*\(|func\s+\w+|impl\s+Solution|var\s+\w+\s*=\s*function|public\s+class|^\s*(?:int|char|void|double|bool|struct)\b[^=\n]*\(/m;
const LOAD_ERROR = "Couldn't load this problem's testcases. Press Run to capture them.";
const TOO_LARGE_ERROR = "This testcase is too large to draw.";
const FALLBACK_LANG = "cpp";
const QUESTION_TIMEOUT_MS = 10_000;
const RUN_URL = /\/interpret_solution\/?$|\/interpret_solution\//;
const CHECK_URL = /\/submissions\/detail\/([^/?]+)\/check\/?/;
const IN_FLIGHT = new Set(["PENDING", "STARTED"]);
const MAX_PENDING_RUNS = 32;

let problem: ProblemState | null = null;
let tracingEnabled = false;
let hooksActive = false;
let nextRunSequence = 0;
const pendingRuns = new Map<number, PendingRun>();
const pendingResults = new Map<string, PendingRun>();

function onPageMessage(event: MessageEvent): void {
  if (event.source !== window) return;
  if (event.origin !== location.origin) return;
  if (!isPageControlMessage(event.data)) return;
  if (event.data.type === "trace") {
    tracingEnabled = event.data.enabled;
    return;
  }
  if (event.data.enabled) activate();
  else deactivate();
}

window.addEventListener("message", onPageMessage);

function docOf(content: CMNode): string | null {
  const view = content.cmView?.rootView?.view;
  const text = view?.state?.doc?.toString();
  return typeof text === "string" ? text : null;
}

function captureCode(): string {
  for (const el of document.querySelectorAll<CMNode>(".cm-content")) {
    const text = docOf(el);
    if (text !== null && CODE_HINTS.test(text)) return text;
  }
  return "";
}

function slugOf(): string {
  const slug = location.pathname.match(/\/problems\/([^/]+)/)?.[1] ?? "";
  return slug.length <= MAX_SLUG_LENGTH ? slug : "";
}

function isLang(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_LANG_LENGTH;
}

function storedLang(): unknown {
  try {
    const raw = localStorage.getItem("global_lang");
    return raw ? (JSON.parse(raw) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

function domLang(): string {
  const button = document.querySelector<HTMLElement>("[id^='headlessui-listbox-button'], button[data-state]");
  return (button?.textContent ?? "").trim().toLowerCase().replace(/[^a-z0-9+#]/g, "");
}

function langOf(requested?: string): string {
  if (isLang(requested)) return requested;
  const stored = storedLang();
  if (isLang(stored)) return stored;
  const fromDom = domLang();
  return isLang(fromDom) ? fromDom : FALLBACK_LANG;
}

function post(snapshot: Snapshot): void {
  window.postMessage({ channel: PAGE_CHANNEL, type: "snapshot", payload: snapshot }, location.origin);
}

function postClear(): void {
  window.postMessage(pageClearMessage(), location.origin);
}

function enqueue(state: ProblemState, task: () => void | Promise<void>): void {
  state.queue = state.queue
    .then(() => (problem === state ? task() : undefined))
    .catch(() => undefined);
}

function publishState(state: ProblemState): void {
  if (!hooksActive || problem !== state || !state.snapshot || state.posted === state.snapshot) return;
  state.posted = state.snapshot;
  post(state.snapshot);
}

function commit(state: ProblemState, snapshot: Snapshot): void {
  state.snapshot = snapshot;
  publishState(state);
}

function snapshotOf(
  state: ProblemState,
  source: Snapshot["source"],
  cases: string[],
  code: string,
  lang: string,
): Snapshot {
  const fits = cases.every((entry) => entry.length <= MAX_SNAPSHOT_CASE_LENGTH);
  const snapshot: Snapshot = {
    cases: fits ? cases : [],
    code: code.length <= MAX_CODE_LENGTH ? code : "",
    lang,
    slug: state.slug,
    source,
    at: Date.now(),
  };
  if (state.params) snapshot.params = state.params;
  if (!fits) snapshot.captureError = TOO_LARGE_ERROR;
  return snapshot;
}

function sameCases(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((entry, index) => entry === right[index]);
}

function nextData(): unknown {
  const fromWindow = (window as { __NEXT_DATA__?: unknown }).__NEXT_DATA__;
  if (fromWindow !== undefined) return fromWindow;
  try {
    const text = document.getElementById("__NEXT_DATA__")?.textContent;
    return text ? (JSON.parse(text) as unknown) : undefined;
  } catch {
    return undefined;
  }
}

function pageFetch(): typeof window.fetch {
  return networkPatched ? nativeFetch : window.fetch;
}

async function fetchQuestion(slug: string): Promise<QuestionData | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), QUESTION_TIMEOUT_MS);
  try {
    const response = await pageFetch().call(window, "/graphql", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ query: QUESTION_QUERY, variables: { titleSlug: slug } }),
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return questionFromGraphql(await response.json());
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function readQuestion(slug: string): Promise<QuestionData | null> {
  return questionFromNextData(nextData(), slug) ?? (await fetchQuestion(slug));
}

function editedCases(slug: string, lineCount: number | null): string[] | null {
  try {
    return parseEditCache(sessionStorage.getItem(editCacheKey(slug)), lineCount);
  } catch {
    return null;
  }
}

function load(state: ProblemState): void {
  state.loading = true;
  enqueue(state, async () => {
    const data = await readQuestion(state.slug);
    if (problem !== state) return;
    state.loading = false;
    const question = data ? parseQuestion(data) : null;
    state.loaded = question !== null;
    state.lineCount = question?.lineCount ?? null;
    if (question?.params) state.params = question.params;
    else delete state.params;
    if (state.snapshot?.source === "network") return;
    const cases = editedCases(state.slug, state.lineCount) ?? question?.cases ?? [];
    const snapshot = snapshotOf(state, "editor", cases, captureCode(), langOf());
    if (cases.length === 0) snapshot.captureError = LOAD_ERROR;
    commit(state, snapshot);
  });
}

function problemFor(slug: string): ProblemState {
  if (problem?.slug === slug) return problem;
  if (problem) postClear();
  clearPending();
  problem = {
    slug,
    lineCount: null,
    loaded: false,
    loading: false,
    queue: Promise.resolve(),
    snapshot: null,
    posted: null,
    latestRun: -1,
  };
  return problem;
}

function ensureLoaded(state: ProblemState): void {
  if (!state.loaded && !state.loading) load(state);
}

function refreshEdits(state: ProblemState): void {
  if (!state.loaded || !state.snapshot) return;
  const cases = editedCases(state.slug, state.lineCount);
  if (!cases) return;
  const snapshot = snapshotOf(state, "editor", cases, captureCode(), langOf());
  if (!sameCases(snapshot.cases, state.snapshot.cases)) commit(state, snapshot);
}

function parseRunBody(body: unknown): RunRequest | null {
  if (typeof body !== "string") return null;
  const parsed = parseObject(body);
  if (!parsed || typeof parsed.data_input !== "string") return null;
  const run: RunRequest = { dataInput: parsed.data_input };
  if (typeof parsed.typed_code === "string") run.code = parsed.typed_code;
  if (typeof parsed.lang === "string") run.lang = parsed.lang;
  return run;
}

function captureRun(body: unknown): number | undefined {
  const run = parseRunBody(body);
  const slug = slugOf();
  if (!run || !slug) return undefined;
  const state = problemFor(slug);
  ensureLoaded(state);
  const sequence = nextRunSequence;
  nextRunSequence += 1;
  const pending: PendingRun = { sequence, state, snapshot: null };
  pendingRuns.set(sequence, pending);
  trimPending();
  enqueue(state, () => {
    const cases = splitDataInput(run.dataInput, state.lineCount) ?? state.snapshot?.cases ?? [];
    pending.snapshot = snapshotOf(state, "network", cases, run.code ?? captureCode(), langOf(run.lang));
    state.latestRun = sequence;
    commit(state, pending.snapshot);
  });
  return sequence;
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? { ...value } : null;
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

function rememberInterpretId(body: Record<string, unknown> | null, sequence: number): void {
  const pending = pendingRuns.get(sequence);
  if (!pending) return;
  pendingRuns.delete(sequence);
  const id = interpretIdOf(body);
  if (!id) return;
  pendingResults.set(id, pending);
  trimPending();
}

function completeRun(url: string, body: Record<string, unknown> | null): void {
  const state = body?.state;
  if (typeof state !== "string" || IN_FLIGHT.has(state)) return;
  const checkId = CHECK_URL.exec(url)?.[1];
  if (!checkId) return;
  const pending = pendingResults.get(checkId);
  if (!pending) return;
  pendingResults.delete(checkId);
  const stdout = extractRunStdout(body);
  const stdoutByCase = extractRunStdoutByCase(body);
  enqueue(pending.state, () => {
    if (!pending.snapshot || pending.sequence !== pending.state.latestRun) return;
    const snapshot: Snapshot = { ...pending.snapshot, at: Date.now() };
    if (stdout !== undefined) snapshot.stdout = stdout;
    if (stdoutByCase !== undefined) snapshot.stdoutByCase = stdoutByCase;
    commit(pending.state, snapshot);
  });
}

function outgoingRun<T>(body: T): T | string {
  const rewritten = tracingEnabled ? instrumentRunBody(body) : null;
  if (rewritten === null) return body;
  instrumented = true;
  return rewritten;
}

function captureInitRun(init: RequestInit | undefined): { sequence: number | undefined; init: RequestInit | undefined } {
  try {
    const sequence = captureRun(init?.body);
    const body = outgoingRun(init?.body);
    return { sequence, init: body !== init?.body && init ? { ...init, body } : init };
  } catch {
    return { sequence: undefined, init };
  }
}

function rememberRun(request: Promise<Response>, sequence: number | undefined): void {
  if (sequence === undefined) return;
  void request
    .then(async (response) => rememberInterpretId(await readResponseJson(response), sequence))
    .catch(() => undefined);
}

async function fetchRequestRun(
  self: typeof globalThis,
  input: Request,
  init: RequestInit | undefined,
): Promise<Response> {
  let text: string | undefined;
  try {
    text = await input.clone().text();
  } catch {
    text = undefined;
  }
  let sequence: number | undefined;
  let body: unknown = text;
  try {
    sequence = captureRun(text);
    body = outgoingRun(text);
  } catch {
    body = text;
  }
  let request: Promise<Response> | undefined;
  if (typeof body === "string" && body !== text) {
    try {
      request = nativeFetch.call(self, new Request(input, { body }), init);
    } catch {
      request = undefined;
    }
  }
  request ??= nativeFetch.call(self, input, init);
  rememberRun(request, sequence);
  return request;
}

function fetchRun(
  self: typeof globalThis,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): Promise<Response> {
  if (input instanceof Request && init?.body === undefined) return fetchRequestRun(self, input, init);
  const captured = captureInitRun(init);
  const request = nativeFetch.call(self, input, captured.init);
  rememberRun(request, captured.sequence);
  return request;
}

function cleanedResponse(response: Response, body: Record<string, unknown>): Response {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  const cleaned = new Response(JSON.stringify(body), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  Object.defineProperty(cleaned, "url", { value: response.url, configurable: true });
  Object.defineProperty(cleaned, "redirected", { value: response.redirected, configurable: true });
  return cleaned;
}

async function fetchCheck(
  self: typeof globalThis,
  url: string,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): Promise<Response> {
  const response = await nativeFetch.call(self, input, init);
  let body: Record<string, unknown> | null;
  try {
    body = parseObject(await response.clone().text());
  } catch {
    return response;
  }
  try {
    completeRun(url, body);
  } catch {
    return response;
  }
  const cleaned = body ? stripCheckBody(body) : null;
  return cleaned ? cleanedResponse(response, cleaned) : response;
}

type Getter = (this: XMLHttpRequest) => unknown;

function nativeGetter(target: object, name: "response" | "responseText"): Getter | undefined {
  for (let proto: object | null = Object.getPrototypeOf(target); proto; proto = Object.getPrototypeOf(proto)) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, name);
    if (descriptor) return descriptor.get;
  }
  return undefined;
}

function rawResponse(xhr: XMLHttpRequest, name: "response" | "responseText"): unknown {
  const getter = nativeGetter(xhr, name);
  return getter ? getter.call(xhr) : xhr[name];
}

function cleanText(text: string): string {
  const body = parseObject(text);
  const cleaned = body ? stripCheckBody(body) : null;
  return cleaned ? JSON.stringify(cleaned) : text;
}

function memo<T>(clean: (raw: T) => T): (raw: T) => T {
  let last: { raw: T; clean: T } | undefined;
  return (raw) => {
    if (last && last.raw === raw) return last.clean;
    last = { raw, clean: clean(raw) };
    return last.clean;
  };
}

function stripXhr(xhr: XMLHttpRequest): void {
  const text = memo<string>(cleanText);
  const value = memo<unknown>((raw) => {
    if (typeof raw === "string") return text(raw);
    const body = asObject(raw);
    return (body && stripCheckBody(body)) ?? raw;
  });
  try {
    Object.defineProperty(xhr, "responseText", {
      configurable: true,
      get() {
        const raw = rawResponse(xhr, "responseText");
        return typeof raw === "string" ? text(raw) : raw;
      },
    });
    Object.defineProperty(xhr, "response", {
      configurable: true,
      get() {
        const raw = rawResponse(xhr, "response");
        return xhr.responseType === "" || xhr.responseType === "text" || xhr.responseType === "json" ? value(raw) : raw;
      },
    });
  } catch {
    return;
  }
}

function xhrBody(xhr: XMLHttpRequest): Record<string, unknown> | null {
  if (xhr.responseType === "json") return asObject(rawResponse(xhr, "response"));
  if (xhr.responseType === "" || xhr.responseType === "text") {
    const text = rawResponse(xhr, "responseText");
    return typeof text === "string" ? parseObject(text) : null;
  }
  return null;
}

let networkPatched = false;
let instrumented = false;
let nativeFetch: typeof window.fetch;
let nativeOpen: typeof XMLHttpRequest.prototype.open;
let nativeSend: typeof XMLHttpRequest.prototype.send;
let xhrUrls = new WeakMap<XMLHttpRequest, string>();

function patchNetwork(): void {
  if (networkPatched) return;
  nativeFetch = window.fetch;
  window.fetch = function patched(this: typeof globalThis, input: RequestInfo | URL, init?: RequestInit) {
    const url = requestUrl(input);
    if (CHECK_URL.test(url) && (hooksActive || instrumented)) return fetchCheck(this, url, input, init);
    if (hooksActive && RUN_URL.test(url)) return fetchRun(this, input, init);
    return nativeFetch.call(this, input, init);
  };

  nativeOpen = XMLHttpRequest.prototype.open;
  nativeSend = XMLHttpRequest.prototype.send;
  xhrUrls = new WeakMap<XMLHttpRequest, string>();

  XMLHttpRequest.prototype.open = function open(this: XMLHttpRequest, method: string, url: string | URL, ...rest: unknown[]) {
    xhrUrls.set(this, String(url));
    return (nativeOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof XMLHttpRequest.prototype.open;

  XMLHttpRequest.prototype.send = function send(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const url = xhrUrls.get(this) ?? "";
    if (CHECK_URL.test(url) && (hooksActive || instrumented)) stripXhr(this);
    if (!hooksActive) return nativeSend.call(this, body);
    let nextBody = body;
    let sequence: number | undefined;
    try {
      if (RUN_URL.test(url)) {
        sequence = captureRun(body);
        nextBody = outgoingRun(body);
      }
    } catch {
      nextBody = body;
    }

    if (RUN_URL.test(url) || CHECK_URL.test(url)) {
      this.addEventListener("load", () => {
        try {
          const parsed = xhrBody(this);
          if (RUN_URL.test(url)) {
            if (sequence !== undefined) rememberInterpretId(parsed, sequence);
          } else {
            completeRun(url, parsed);
          }
        } catch {
          return;
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

function activate(): void {
  const slug = slugOf();
  if (!slug) return;
  if (hooksActive && problem?.slug === slug) return;
  hooksActive = true;
  patchNetwork();
  const state = problemFor(slug);
  ensureLoaded(state);
  enqueue(state, () => {
    refreshEdits(state);
    publishState(state);
  });
}

function deactivate(): void {
  if (!hooksActive) return;
  hooksActive = false;
  clearPending();
  if (!instrumented) unpatchNetwork();
  if (problem) problem.posted = null;
  postClear();
}
