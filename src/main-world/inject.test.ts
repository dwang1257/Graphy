import { afterEach, expect, test, vi } from "vitest";

import {
  MAX_CODE_LENGTH,
  MAX_LANG_LENGTH,
  MAX_SNAPSHOT_CASE_LENGTH,
  isPageMessage,
  pageHooksMessage,
  pageTraceMessage,
  type Snapshot,
} from "../shared/protocol.js";
import { TRACE_SENTINEL } from "../core/traceWire.js";
import { GRAPHY_TRACE_MARK } from "./instrument.js";
import { QUESTION_QUERY } from "./question.js";

interface QuestionFixture {
  exampleTestcaseList: string[];
  metaData: string;
}

interface HarnessOptions {
  path?: string;
  nextData?: unknown;
  graphql?: Record<string, QuestionFixture | null>;
  delayGraphql?: boolean;
  session?: Record<string, string>;
  code?: string;
  storedLanguage?: string;
  domLanguage?: string;
  interpretIds?: Record<string, string>;
}

interface GraphqlRequest {
  url: string;
  init: RequestInit | undefined;
  slug: string;
}

class FakeXhr {
  static sentBodies: unknown[] = [];
  static responseFor: (url: string, body: unknown) => string = () => "";
  responseType: XMLHttpRequestResponseType = "";
  private text = "";
  private url = "";
  private readonly listeners: Array<{ type: string; fn: EventListener }> = [];

  open(_method?: string, url?: string | URL): void {
    this.url = String(url);
  }

  send(body?: Document | XMLHttpRequestBodyInit | null): void {
    FakeXhr.sentBodies.push(body);
    this.text = FakeXhr.responseFor(this.url, body);
    for (const listener of this.listeners.filter((entry) => entry.type === "load")) {
      listener.fn.call(this, new Event("load"));
    }
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (typeof listener !== "function") return;
    this.listeners.push({ type, fn: listener });
  }

  get responseText(): string {
    if (this.responseType !== "" && this.responseType !== "text") {
      throw new DOMException("responseText is only available for text responses", "InvalidStateError");
    }
    return this.text;
  }

  get response(): unknown {
    if (this.responseType === "json") return this.text ? (JSON.parse(this.text) as unknown) : null;
    if (this.responseType === "blob") return new Blob([this.text]);
    return this.text;
  }
}

const TWO_SUM: QuestionFixture = {
  exampleTestcaseList: ["[2,7,11,15]\n9", "[3,2,4]\n6", "[3,3]\n6"],
  metaData: JSON.stringify({
    name: "twoSum",
    params: [
      { name: "nums", type: "integer[]" },
      { name: "target", type: "integer" },
    ],
    return: { type: "integer[]", size: 2 },
  }),
};

const MAX_DEPTH: QuestionFixture = {
  exampleTestcaseList: ["[3,9,20,null,null,15,7]", "[1,null,2]"],
  metaData: JSON.stringify({ name: "maxDepth", params: [{ name: "root", type: "TreeNode" }], return: { type: "integer" } }),
};

const MERGE_LISTS: QuestionFixture = {
  exampleTestcaseList: ["[1,2,4]\n[1,3,4]", "[]\n[]", "[]\n[0]"],
  metaData: JSON.stringify({
    name: "mergeTwoLists",
    params: [
      { dealloc: false, name: "list1", type: "ListNode" },
      { dealloc: false, name: "list2", type: "ListNode" },
    ],
    return: { type: "ListNode", dealloc: true },
  }),
};

const MIN_STACK: QuestionFixture = {
  exampleTestcaseList: ["[\"MinStack\",\"push\",\"push\",\"getMin\"]\n[[],[-2],[0],[]]"],
  metaData: JSON.stringify({
    classname: "MinStack",
    constructor: { params: [] },
    methods: [{ name: "push", params: [{ type: "integer", name: "val" }], return: { type: "void" } }],
    systemdesign: true,
  }),
};

const TWO_SUM_PARAMS = [
  { name: "nums", type: "integer[]" },
  { name: "target", type: "integer" },
];

function nextDataFor(slug: string, question: QuestionFixture): unknown {
  return {
    props: {
      pageProps: {
        dehydratedState: {
          queries: [
            { queryKey: ["globalData"], state: { data: {} } },
            { queryKey: ["questionDetail", { titleSlug: slug }], state: { data: { question } } },
          ],
        },
      },
    },
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function checkResponse(body: unknown): Response {
  const text = JSON.stringify(body);
  const response = new Response(text, {
    status: 200,
    statusText: "OK",
    headers: { "Content-Type": "application/json", "Content-Length": String(text.length) },
  });
  Object.defineProperty(response, "url", { value: "https://leetcode.com/submissions/detail/interp-1/check/" });
  return response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function installPage(options: HarnessOptions = {}) {
  const messages: Array<{ type?: string; payload?: Snapshot }> = [];
  const pageListeners: Array<(event: MessageEvent) => void> = [];
  const graphqlRequests: GraphqlRequest[] = [];
  const delayed: Array<{ slug: string; release: () => void }> = [];
  const sentBodies: string[] = [];
  let nativeFetchCalls = 0;
  let checkBody: Record<string, unknown> = { state: "SUCCESS" };
  let checkRaw: string | undefined;
  const locationState = { pathname: options.path ?? "/problems/two-sum/", origin: "https://leetcode.com" };
  const session = new Map(Object.entries(options.session ?? {}));
  const interpretIds = options.interpretIds ?? {};
  FakeXhr.sentBodies = [];

  function interpretIdFor(body: unknown): string {
    const parsed = typeof body === "string" ? (JSON.parse(body) as { data_input?: string }) : {};
    return (parsed.data_input !== undefined ? interpretIds[parsed.data_input] : undefined) ?? "interp-1";
  }

  FakeXhr.responseFor = (url, body) => {
    if (url.includes("interpret_solution")) return JSON.stringify({ interpret_id: interpretIdFor(body) });
    if (url.includes("/check")) return checkRaw ?? JSON.stringify(checkBody);
    return "";
  };

  const codeEditor = {
    cmView: { rootView: { view: { state: { doc: { toString: () => options.code ?? "class Solution {};" } } } } },
  };

  const fakeWindow: Record<string, unknown> = {
    postMessage: (message: { type?: string; payload?: Snapshot }) => {
      messages.push(message);
    },
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type !== "message" || typeof listener !== "function") return;
      pageListeners.push(listener as (event: MessageEvent) => void);
    },
    fetch: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      nativeFetchCalls += 1;
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url === "/graphql") {
        const body = JSON.parse(String(init?.body)) as { variables: { titleSlug: string } };
        const slug = body.variables.titleSlug;
        graphqlRequests.push({ url, init, slug });
        const respond = () => jsonResponse({ data: { question: options.graphql?.[slug] ?? null } });
        if (!options.delayGraphql) return Promise.resolve(respond());
        return new Promise((resolve) => delayed.push({ slug, release: () => resolve(respond()) }));
      }
      if (url.includes("interpret_solution")) {
        if (typeof init?.body === "string") {
          sentBodies.push(init.body);
          return Promise.resolve(jsonResponse({ interpret_id: interpretIdFor(init.body) }));
        }
        if (input instanceof Request) {
          return input.clone().text().then((text) => {
            sentBodies.push(text);
            return jsonResponse({ interpret_id: interpretIdFor(text) });
          });
        }
        return Promise.resolve(jsonResponse({ interpret_id: interpretIdFor(init?.body) }));
      }
      if (url.includes("/check")) {
        if (checkRaw !== undefined) return Promise.resolve(new Response(checkRaw, { status: 200 }));
        return Promise.resolve(checkResponse(checkBody));
      }
      return Promise.resolve(new Response());
    },
  };
  if (options.nextData !== undefined) fakeWindow.__NEXT_DATA__ = options.nextData;

  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("location", locationState);
  vi.stubGlobal("document", {
    querySelectorAll: (selector: string) => (selector === ".cm-content" ? [codeEditor] : []),
    querySelector: (selector: string) =>
      selector.includes("headlessui-listbox-button") ? ({ textContent: options.domLanguage ?? "" } as HTMLElement) : null,
    getElementById: () => null,
  });
  vi.stubGlobal("localStorage", { getItem: () => options.storedLanguage ?? JSON.stringify("cpp") });
  vi.stubGlobal("sessionStorage", { getItem: (key: string) => session.get(key) ?? null });
  class HarnessXhr extends FakeXhr {}
  vi.stubGlobal("XMLHttpRequest", HarnessXhr);

  function dispatch(data: unknown): void {
    const event = { data, origin: locationState.origin, source: fakeWindow } as unknown as MessageEvent;
    for (const listener of pageListeners) listener(event);
  }

  return {
    messages: () => messages,
    snapshots: () => messages.filter((message) => message.type === "snapshot").map((message) => message.payload as Snapshot),
    messageTypes: () => messages.map((message) => message.type),
    clears: () => messages.filter((message) => message.type === "clear").length,
    graphqlRequests,
    sentBodies,
    nativeFetchCalls: () => nativeFetchCalls,
    xhrBodies: () => FakeXhr.sentBodies,
    activate: () => dispatch(pageHooksMessage(true)),
    deactivate: () => dispatch(pageHooksMessage(false)),
    dispatch,
    navigate: (path: string) => {
      locationState.pathname = path;
    },
    setSession: (key: string, value: string) => session.set(key, value),
    setCheck: (body: Record<string, unknown>) => {
      checkBody = body;
      checkRaw = undefined;
    },
    setCheckRaw: (text: string) => {
      checkRaw = text;
    },
    releaseGraphql: (slug: string) => {
      const index = delayed.findIndex((entry) => entry.slug === slug);
      const [entry] = delayed.splice(index, 1);
      entry?.release();
    },
  };
}

type Page = ReturnType<typeof installPage>;

async function flush(): Promise<void> {
  for (let i = 0; i < 5; i += 1) await new Promise((resolve) => setTimeout(resolve, 0));
}

async function boot(options: HarnessOptions = {}): Promise<Page> {
  const page = installPage(options);
  await import("./inject.js");
  page.activate();
  await flush();
  return page;
}

async function run(dataInput: string, extra: Record<string, unknown> = {}): Promise<void> {
  await window.fetch("https://leetcode.com/problems/two-sum/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: dataInput, typed_code: "class Solution {};", lang: "cpp", question_id: "1", ...extra }),
  });
  await flush();
}

async function check(id = "interp-1"): Promise<void> {
  await window.fetch(`https://leetcode.com/submissions/detail/${id}/check/`);
  await flush();
}

test("loads examples and params from __NEXT_DATA__ when its slug matches the page", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });

  expect(page.graphqlRequests).toEqual([]);
  expect(page.snapshots()).toHaveLength(1);
  const [snapshot] = page.snapshots();
  expect(snapshot).toMatchObject({
    cases: ["[2,7,11,15]\n9", "[3,2,4]\n6", "[3,3]\n6"],
    params: TWO_SUM_PARAMS,
    slug: "two-sum",
    source: "editor",
    lang: "cpp",
    code: "class Solution {};",
  });
  expect(snapshot?.captureError).toBeUndefined();
});

test("fetches the question over GraphQL with the native fetch when __NEXT_DATA__ is stale", async () => {
  const page = await boot({
    path: "/problems/merge-two-sorted-lists/description/",
    nextData: nextDataFor("two-sum", TWO_SUM),
    graphql: { "merge-two-sorted-lists": MERGE_LISTS },
  });

  expect(page.graphqlRequests).toHaveLength(1);
  const request = page.graphqlRequests[0];
  expect(request?.slug).toBe("merge-two-sorted-lists");
  expect(request?.init).toMatchObject({ method: "POST", credentials: "same-origin" });
  expect(JSON.parse(String(request?.init?.body))).toEqual({
    query: QUESTION_QUERY,
    variables: { titleSlug: "merge-two-sorted-lists" },
  });
  expect(page.snapshots().map((snapshot) => snapshot.cases)).toEqual([["[1,2,4]\n[1,3,4]", "[]\n[]", "[]\n[0]"]]);
  expect(page.snapshots()[0]?.params).toEqual([
    { name: "list1", type: "ListNode" },
    { name: "list2", type: "ListNode" },
  ]);
});

test("prefers the user's edited testcases from sessionStorage", async () => {
  const page = await boot({
    nextData: nextDataFor("two-sum", TWO_SUM),
    session: { "QD_TESTCASE_CACHE_two-sum": JSON.stringify([["[2,7,11,15,99]", "9"], ["[3,3]", "6"]]) },
  });

  expect(page.snapshots().map((snapshot) => snapshot.cases)).toEqual([["[2,7,11,15,99]\n9", "[3,3]\n6"]]);
});

test.each([
  ["invalid JSON", "{"],
  ["an object", JSON.stringify({ cases: [] })],
  ["an empty list", "[]"],
  ["non-string params", JSON.stringify([[1, 2]])],
  ["the wrong param count", JSON.stringify([["[1]"]])],
])("ignores an edit cache holding %s", async (_label, raw) => {
  const page = await boot({
    nextData: nextDataFor("two-sum", TWO_SUM),
    session: { "QD_TESTCASE_CACHE_two-sum": raw },
  });

  expect(page.snapshots().map((snapshot) => snapshot.cases)).toEqual([TWO_SUM.exampleTestcaseList]);
});

test("loads once per slug and republishes the same snapshot when the panel reopens", async () => {
  const page = await boot({ graphql: { "two-sum": TWO_SUM } });
  page.activate();
  await flush();
  expect(page.snapshots()).toHaveLength(1);

  page.deactivate();
  expect(page.clears()).toBe(1);
  page.activate();
  await flush();

  expect(page.graphqlRequests).toHaveLength(1);
  expect(page.snapshots()).toHaveLength(2);
  expect(page.snapshots()[1]).toEqual(page.snapshots()[0]);
  expect(page.snapshots()[1]?.cases).toEqual(TWO_SUM.exampleTestcaseList);
});

test("reopening picks up testcases edited while the panel was closed without refetching", async () => {
  const page = await boot({ graphql: { "two-sum": TWO_SUM } });
  page.deactivate();
  page.setSession("QD_TESTCASE_CACHE_two-sum", JSON.stringify([["[9]", "9"], ["[1,8]", "9"]]));

  page.activate();
  await flush();

  expect(page.graphqlRequests).toHaveLength(1);
  expect(page.snapshots()).toHaveLength(2);
  expect(page.snapshots()[1]).toMatchObject({
    cases: ["[9]\n9", "[1,8]\n9"],
    source: "editor",
    params: TWO_SUM_PARAMS,
  });
});

test("reopening ignores an edit cache that does not match the parameter count", async () => {
  const page = await boot({ graphql: { "two-sum": TWO_SUM } });
  page.deactivate();
  page.setSession("QD_TESTCASE_CACHE_two-sum", JSON.stringify([["[9]"]]));

  page.activate();
  await flush();

  expect(page.snapshots()).toHaveLength(2);
  expect(page.snapshots()[1]).toEqual(page.snapshots()[0]);
});

test("reopening keeps a Run's stdout when the edit cache still holds the Run's cases", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  await run("[4]\n5");
  page.setSession("QD_TESTCASE_CACHE_two-sum", JSON.stringify([["[4]", "5"]]));
  page.setCheck({ state: "SUCCESS", std_output_list: ["out"] });
  await check();
  const latest = page.snapshots().at(-1);

  page.deactivate();
  page.activate();
  await flush();
  expect(page.snapshots().at(-1)).toEqual(latest);
  expect(latest?.stdoutByCase).toEqual(["out"]);
});

test("publishes a Run immediately with cases split by the parameter count, then again with stdout", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });

  await run("[1,2]\n3\n[4]\n5\n[6,7]\n8", { typed_code: "class Solution { int x; };", lang: "java" });
  expect(page.snapshots()).toHaveLength(2);
  expect(page.snapshots()[1]).toMatchObject({
    cases: ["[1,2]\n3", "[4]\n5", "[6,7]\n8"],
    source: "network",
    code: "class Solution { int x; };",
    lang: "java",
    params: TWO_SUM_PARAMS,
  });
  expect(page.snapshots()[1]?.stdout).toBeUndefined();

  page.setCheck({ state: "SUCCESS", code_output: ["#graphy current n0"], std_output_list: ["a", "b", "c"] });
  await check();
  expect(page.snapshots()).toHaveLength(3);
  expect(page.snapshots()[2]).toMatchObject({
    cases: ["[1,2]\n3", "[4]\n5", "[6,7]\n8"],
    source: "network",
    stdout: "#graphy current n0",
    stdoutByCase: ["a", "b", "c"],
  });
});

test("waits for a terminal check state before publishing stdout", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  await run("[1]\n2");
  page.setCheck({ state: "PENDING" });
  await check();
  page.setCheck({ state: "STARTED" });
  await check();
  expect(page.snapshots()).toHaveLength(2);

  page.setCheck({ state: "SUCCESS", code_output: ["done"] });
  await check();
  expect(page.snapshots()).toHaveLength(3);
  expect(page.snapshots()[2]?.stdout).toBe("done");
});

test("splits linked-list and system design Runs into their cases", async () => {
  const lists = await boot({ path: "/problems/merge-two-sorted-lists/", nextData: nextDataFor("merge-two-sorted-lists", MERGE_LISTS) });
  await run("[1]\n[2]\n[]\n[]");
  expect(lists.snapshots().at(-1)?.cases).toEqual(["[1]\n[2]", "[]\n[]"]);

  vi.unstubAllGlobals();
  vi.resetModules();
  const stack = await boot({ path: "/problems/min-stack/", nextData: nextDataFor("min-stack", MIN_STACK) });
  expect(stack.snapshots()[0]?.cases).toEqual(MIN_STACK.exampleTestcaseList);
  expect(stack.snapshots()[0]?.params).toBeUndefined();
  await run("[\"MinStack\",\"push\"]\n[[],[1]]\n[\"MinStack\",\"getMin\"]\n[[],[]]");
  expect(stack.snapshots().at(-1)?.cases).toEqual([
    "[\"MinStack\",\"push\"]\n[[],[1]]",
    "[\"MinStack\",\"getMin\"]\n[[],[]]",
  ]);
  expect(stack.snapshots().at(-1)?.params).toBeUndefined();
});

test("keeps the previous cases when the Run input is blank", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  await run("");
  expect(page.snapshots().at(-1)).toMatchObject({ source: "network", cases: TWO_SUM.exampleTestcaseList });

  await run("[5]\n6");
  await run("  \n ");
  expect(page.snapshots().at(-1)?.cases).toEqual(["[5]\n6"]);
});

test("falls back to one case when the Run input does not divide into parameter lines", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  await run("[1]\n2\n3");
  expect(page.snapshots().at(-1)?.cases).toEqual(["[1]\n2\n3"]);
});

test("reports a load failure and still splits Runs into one case without metadata", async () => {
  const page = await boot({ graphql: {} });
  expect(page.snapshots()).toHaveLength(1);
  expect(page.snapshots()[0]).toMatchObject({
    cases: [],
    source: "editor",
    captureError: "Couldn't load this problem's testcases. Press Run to capture them.",
  });

  await run("[1]\n2\n[3]\n4");
  expect(page.snapshots().at(-1)).toMatchObject({ cases: ["[1]\n2\n[3]\n4"], source: "network" });
  expect(page.snapshots().at(-1)?.captureError).toBeUndefined();
});

test("waits for question metadata before splitting a Run sent during the load", async () => {
  const page = installPage({ graphql: { "two-sum": TWO_SUM }, delayGraphql: true });
  await import("./inject.js");
  page.activate();
  await run("[1]\n2\n[3]\n4");
  expect(page.snapshots()).toEqual([]);

  page.releaseGraphql("two-sum");
  await flush();
  expect(page.snapshots().map((snapshot) => snapshot.source)).toEqual(["editor", "network"]);
  expect(page.snapshots()[1]?.cases).toEqual(["[1]\n2", "[3]\n4"]);
});

test("does not patch the network or capture anything while hooks are inactive", async () => {
  const page = installPage({ nextData: nextDataFor("two-sum", TWO_SUM) });
  const pythonCode = "class Solution:\n    def twoSum(self, nums, target):\n        return []\n";
  await import("./inject.js");

  await window.fetch("https://leetcode.com/problems/two-sum/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[1]\n2", typed_code: pythonCode, lang: "python3" }),
  });
  await flush();
  expect(page.nativeFetchCalls()).toBe(1);
  expect(page.snapshots()).toEqual([]);

  page.activate();
  page.dispatch(pageTraceMessage(true));
  await flush();
  page.deactivate();
  const before = page.snapshots().length;
  await window.fetch("https://leetcode.com/problems/two-sum/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[1]\n2", typed_code: pythonCode, lang: "python3" }),
  });
  await flush();
  expect(JSON.parse(page.sentBodies.at(-1) ?? "{}").typed_code).toBe(pythonCode);
  expect(page.snapshots()).toHaveLength(before);

  expect(XMLHttpRequest.prototype.send).toBe(FakeXhr.prototype.send);
  const rawBody = JSON.stringify({ data_input: "[1]\n2", typed_code: pythonCode, lang: "python3" });
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "https://leetcode.com/problems/two-sum/interpret_solution/");
  xhr.send(rawBody);
  await flush();
  expect(page.xhrBodies().at(-1)).toBe(rawBody);
  expect(page.snapshots()).toHaveLength(before);
});

test("captures Runs and results sent through XMLHttpRequest", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "https://leetcode.com/problems/two-sum/interpret_solution/");
  xhr.send(JSON.stringify({ data_input: "[8]\n9", typed_code: "class Solution {};", lang: "cpp" }));
  await flush();
  expect(page.snapshots().at(-1)).toMatchObject({ cases: ["[8]\n9"], source: "network" });

  page.setCheck({ state: "SUCCESS", code_output: ["xhr"] });
  const poll = new XMLHttpRequest();
  poll.open("GET", "https://leetcode.com/submissions/detail/interp-1/check/");
  poll.send();
  await flush();
  expect(page.snapshots().at(-1)).toMatchObject({ cases: ["[8]\n9"], stdout: "xhr" });
});

test("resets and loads the new problem after SPA navigation", async () => {
  const page = await boot({
    nextData: nextDataFor("two-sum", TWO_SUM),
    graphql: { "maximum-depth-of-binary-tree": MAX_DEPTH },
  });
  await run("[1]\n2");

  page.navigate("/problems/maximum-depth-of-binary-tree/");
  page.activate();
  await flush();

  expect(page.messageTypes()).toEqual(["snapshot", "snapshot", "clear", "snapshot"]);
  expect(page.snapshots().at(-1)).toMatchObject({
    slug: "maximum-depth-of-binary-tree",
    source: "editor",
    cases: ["[3,9,20,null,null,15,7]", "[1,null,2]"],
    params: [{ name: "root", type: "TreeNode" }],
  });
});

test("switches problems when a Run arrives before the navigation is reported", async () => {
  const page = await boot({
    nextData: nextDataFor("two-sum", TWO_SUM),
    graphql: { "maximum-depth-of-binary-tree": MAX_DEPTH },
  });

  page.navigate("/problems/maximum-depth-of-binary-tree/");
  await run("[1,2]\n[3]");
  expect(page.messageTypes()).toEqual(["snapshot", "clear", "snapshot", "snapshot"]);
  expect(page.snapshots().at(-1)).toMatchObject({
    slug: "maximum-depth-of-binary-tree",
    source: "network",
    cases: ["[1,2]", "[3]"],
  });

  page.activate();
  await flush();
  expect(page.snapshots()).toHaveLength(3);
});

test("discards a slow GraphQL response for a problem the user already left", async () => {
  const page = installPage({
    graphql: { "two-sum": TWO_SUM, "maximum-depth-of-binary-tree": MAX_DEPTH },
    delayGraphql: true,
  });
  await import("./inject.js");
  page.activate();
  await flush();

  page.navigate("/problems/maximum-depth-of-binary-tree/");
  page.activate();
  page.releaseGraphql("maximum-depth-of-binary-tree");
  await flush();
  page.releaseGraphql("two-sum");
  await flush();

  expect(page.snapshots().map((snapshot) => snapshot.slug)).toEqual(["maximum-depth-of-binary-tree"]);
});

test("publishes a load that finished while the panel was closed only after it reopens", async () => {
  const page = installPage({ graphql: { "two-sum": TWO_SUM }, delayGraphql: true });
  await import("./inject.js");
  page.activate();
  await flush();
  page.deactivate();
  page.releaseGraphql("two-sum");
  await flush();
  expect(page.snapshots()).toEqual([]);

  page.activate();
  await flush();
  expect(page.graphqlRequests).toHaveLength(1);
  expect(page.snapshots().map((snapshot) => snapshot.cases)).toEqual([TWO_SUM.exampleTestcaseList]);
});

test("reopening after a Run republishes the Run with its stdout", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  await run("[4]\n5");
  page.setCheck({ state: "SUCCESS", std_output_list: ["out"] });
  await check();
  const latest = page.snapshots().at(-1);

  page.deactivate();
  page.activate();
  await flush();
  expect(page.snapshots().at(-1)).toEqual(latest);
  expect(latest).toMatchObject({ cases: ["[4]\n5"], stdoutByCase: ["out"] });
});

const PYTHON_TYPED = "class Solution:\n    def invertTree(self, root):\n        return root\n";

test("appends the Python tracer only after tracing is enabled and reports the original code", async () => {
  const page = await boot({ path: "/problems/invert-binary-tree/", nextData: nextDataFor("invert-binary-tree", MAX_DEPTH) });

  await run("[4,2,7]", { typed_code: PYTHON_TYPED, lang: "python3" });
  expect(JSON.parse(page.sentBodies.at(-1) ?? "{}").typed_code).toBe(PYTHON_TYPED);

  page.dispatch(pageTraceMessage(true));
  await run("[4,2,7]", { typed_code: PYTHON_TYPED, lang: "python3" });
  expect(JSON.parse(page.sentBodies.at(-1) ?? "{}").typed_code).toContain(GRAPHY_TRACE_MARK);
  await check();
  expect(page.snapshots().at(-1)).toMatchObject({ code: PYTHON_TYPED, cases: ["[4,2,7]"] });
});

test("only attaches stdout to the latest of overlapping Runs", async () => {
  const page = await boot({
    nextData: nextDataFor("two-sum", TWO_SUM),
    interpretIds: { "[1]\n1": "interp-a", "[2]\n2": "interp-b" },
  });
  await Promise.all([run("[1]\n1"), run("[2]\n2")]);
  const count = page.snapshots().length;

  page.setCheck({ state: "SUCCESS", code_output: ["late"] });
  await check("interp-a");
  expect(page.snapshots()).toHaveLength(count);

  await check("interp-b");
  expect(page.snapshots().at(-1)).toMatchObject({ cases: ["[2]\n2"], stdout: "late" });
});

test("keeps Run correlation bounded while still pairing the newest result", async () => {
  const interpretIds: Record<string, string> = {};
  for (let index = 0; index < 40; index += 1) interpretIds[`[${index}]\n${index}`] = `interp-${index}`;
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM), interpretIds });

  for (let index = 0; index < 40; index += 1) await run(`[${index}]\n${index}`);
  const count = page.snapshots().length;
  page.setCheck({ state: "SUCCESS", code_output: ["newest"] });
  await check("interp-0");
  expect(page.snapshots()).toHaveLength(count);
  await check("interp-39");
  expect(page.snapshots().at(-1)).toMatchObject({ cases: ["[39]\n39"], stdout: "newest" });
});

test("falls back to the DOM language when the stored language is not a string", async () => {
  const page = await boot({
    nextData: nextDataFor("two-sum", TWO_SUM),
    storedLanguage: JSON.stringify({ value: "python3" }),
    domLanguage: "Python3",
  });
  expect(page.snapshots()[0]?.lang).toBe("python3");
});

test("ignores repeated activation for the same problem", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  page.activate();
  page.activate();
  await flush();
  expect(page.snapshots()).toHaveLength(1);
  expect(page.clears()).toBe(0);
});

test("reports an oversized Run input instead of posting a snapshot the content script would drop", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  const huge = `[${"1,".repeat(50_000)}1]\n9`;
  expect(huge.length).toBeGreaterThan(MAX_SNAPSHOT_CASE_LENGTH);

  await run(huge);

  const message = page.messages().at(-1);
  expect(isPageMessage(message)).toBe(true);
  expect(message?.payload).toMatchObject({
    cases: [],
    source: "network",
    captureError: "This testcase is too large to draw.",
  });

  page.setCheck({ state: "SUCCESS", code_output: ["done"] });
  await check();
  expect(isPageMessage(page.messages().at(-1))).toBe(true);
  expect(page.snapshots().at(-1)).toMatchObject({ cases: [], stdout: "done", captureError: "This testcase is too large to draw." });
});

test("omits oversized code and replaces an invalid language so the snapshot stays deliverable", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  await run("[1]\n2", { typed_code: "x".repeat(MAX_CODE_LENGTH + 1), lang: "l".repeat(MAX_LANG_LENGTH + 1) });

  const message = page.messages().at(-1);
  expect(isPageMessage(message)).toBe(true);
  expect(message?.payload).toMatchObject({ cases: ["[1]\n2"], code: "", lang: "cpp" });
  expect(message?.payload?.captureError).toBeUndefined();
});

test("reads XMLHttpRequest responses delivered as JSON", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  const xhr = new XMLHttpRequest();
  xhr.responseType = "json";
  xhr.open("POST", "https://leetcode.com/problems/two-sum/interpret_solution/");
  xhr.send(JSON.stringify({ data_input: "[8]\n9", typed_code: "class Solution {};", lang: "cpp" }));
  await flush();

  page.setCheck({ state: "SUCCESS", code_output: ["json"] });
  const poll = new XMLHttpRequest();
  poll.responseType = "json";
  poll.open("GET", "https://leetcode.com/submissions/detail/interp-1/check/");
  poll.send();
  await flush();
  expect(page.snapshots().at(-1)).toMatchObject({ cases: ["[8]\n9"], stdout: "json" });
});

test("ignores XMLHttpRequest responses it cannot read as JSON", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  const xhr = new XMLHttpRequest();
  xhr.responseType = "blob";
  xhr.open("POST", "https://leetcode.com/problems/two-sum/interpret_solution/");
  xhr.send(JSON.stringify({ data_input: "[8]\n9", typed_code: "class Solution {};", lang: "cpp" }));
  await flush();
  expect(page.snapshots().at(-1)).toMatchObject({ cases: ["[8]\n9"], source: "network" });

  page.setCheck({ state: "SUCCESS", code_output: ["blob"] });
  await check();
  expect(page.snapshots().at(-1)?.stdout).toBeUndefined();
});

test("captures a Run sent as a Request object without an init", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  const request = new Request("https://leetcode.com/problems/two-sum/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[6]\n7\n[8]\n9", typed_code: "class Solution {};", lang: "cpp" }),
  });

  await window.fetch(request);
  await flush();
  expect(request.bodyUsed).toBe(false);
  expect(page.snapshots().at(-1)).toMatchObject({ cases: ["[6]\n7", "[8]\n9"], source: "network" });

  page.setCheck({ state: "SUCCESS", std_output_list: ["a", "b"] });
  await check();
  expect(page.snapshots().at(-1)).toMatchObject({ cases: ["[6]\n7", "[8]\n9"], stdoutByCase: ["a", "b"] });
});

const TRACE_LINE = `${TRACE_SENTINEL}0 @root=0 0`;

test("strips trace lines from the fetched check response while the snapshot keeps them", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  await run("[1]\n2\n[3]\n4");
  page.setCheck({
    state: "SUCCESS",
    code_output: ["user line", TRACE_LINE, `${TRACE_SENTINEL}1 @root=0`],
    std_output_list: [`user line\n${TRACE_LINE}\n`, `${TRACE_SENTINEL}1 @root=0\n`],
    std_output: `mid\n${TRACE_LINE}`,
  });
  const response = await window.fetch("https://leetcode.com/submissions/detail/interp-1/check/");
  await flush();

  expect(response.url).toBe("https://leetcode.com/submissions/detail/interp-1/check/");
  expect(response.status).toBe(200);
  expect(response.headers.get("content-length")).toBeNull();
  expect(await response.json()).toEqual({
    state: "SUCCESS",
    code_output: ["user line"],
    std_output_list: ["user line\n", ""],
    std_output: "mid\n",
  });
  expect(page.snapshots().at(-1)).toMatchObject({
    stdout: `user line\n${TRACE_LINE}\n${TRACE_SENTINEL}1 @root=0`,
    stdoutByCase: [`user line\n${TRACE_LINE}\n`, `${TRACE_SENTINEL}1 @root=0\n`],
  });
});

test("returns the original check response when there is nothing to strip", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  await run("[1]\n2");
  page.setCheck({ state: "SUCCESS", code_output: ["plain"] });
  const response = await window.fetch("https://leetcode.com/submissions/detail/interp-1/check/");
  expect(response.headers.get("content-length")).not.toBeNull();
  expect(await response.json()).toEqual({ state: "SUCCESS", code_output: ["plain"] });

  page.setCheckRaw("not json");
  const text = await window.fetch("https://leetcode.com/submissions/detail/interp-1/check/");
  expect(await text.text()).toBe("not json");
});

test.each(["", "text", "json"] as const)("strips trace lines for XMLHttpRequest check polls with responseType %j", async (responseType) => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  await run("[1]\n2");
  page.setCheck({ state: "SUCCESS", code_output: ["kept", TRACE_LINE] });
  const poll = new XMLHttpRequest();
  poll.responseType = responseType;
  const seen: unknown[] = [];
  poll.addEventListener("load", () => {
    seen.push(responseType === "json" ? poll.response : JSON.parse(poll.responseText));
  });
  poll.open("GET", "https://leetcode.com/submissions/detail/interp-1/check/");
  poll.send();
  await flush();

  expect(seen).toEqual([{ state: "SUCCESS", code_output: ["kept"] }]);
  expect(page.snapshots().at(-1)?.stdout).toBe(`kept\n${TRACE_LINE}`);
});

test("instruments a Python Run sent as a Request object", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  page.dispatch(pageTraceMessage(true));
  await flush();
  const code = "class Solution:\n    def twoSum(self, nums, target):\n        return []\n";
  const request = new Request("https://leetcode.com/problems/two-sum/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[1]\n2", typed_code: code, lang: "python3" }),
  });
  await window.fetch(request);
  await flush();
  expect(JSON.parse(page.sentBodies.at(-1) ?? "{}").typed_code).toContain(GRAPHY_TRACE_MARK);
  expect(page.snapshots().at(-1)).toMatchObject({ code, cases: ["[1]\n2"] });
});

test("keeps stripping check responses after the panel closes on an instrumented Run", async () => {
  const page = await boot({ nextData: nextDataFor("two-sum", TWO_SUM) });
  page.dispatch(pageTraceMessage(true));
  await run("[1]\n2", { typed_code: PYTHON_TYPED, lang: "python3" });
  page.deactivate();
  page.setCheck({ state: "SUCCESS", code_output: [`done${TRACE_LINE}`] });
  const response = await window.fetch("https://leetcode.com/submissions/detail/interp-1/check/");
  expect(await response.json()).toEqual({ state: "SUCCESS", code_output: ["done"] });
  const poll = new XMLHttpRequest();
  poll.open("GET", "https://leetcode.com/submissions/detail/interp-1/check/");
  poll.send();
  expect(JSON.parse(poll.responseText)).toEqual({ state: "SUCCESS", code_output: ["done"] });
});
