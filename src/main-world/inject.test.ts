import { afterEach, expect, test, vi } from "vitest";

import { pageClearMessage, pageHooksMessage, pageTraceMessage } from "../shared/protocol.js";

interface PageHarness {
  snapshots: Array<{ payload: SnapshotPayload }>;
  clearMessages(): number;
  sentBodies: string[];
  flushCapture(): Promise<void>;
  selectedIndex(): number;
  tabClicks(): number;
  activate(): void;
  deactivate(): void;
  mountTestcases(): void;
  nativeFetchCalls(): number;
  xhrBodies(): unknown[];
  dispatchPageMessage(data: unknown): void;
  setCheckState(state: string): void;
  setCheckStdout(lines: string[] | undefined): void;
  setCheckStdOutputList(entries: string[] | undefined): void;
}

interface SnapshotPayload {
  cases: string[];
  source: string;
  lang: string;
  code?: string;
  stdout?: string;
  stdoutByCase?: string[];
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function cmContent(text: string): HTMLElement {
  return {
    cmView: {
      rootView: {
        view: {
          state: {
            doc: { toString: () => text },
          },
        },
      },
    },
    querySelector: () => null,
    matches: () => false,
  } as unknown as HTMLElement;
}

function inputWrapper(text: string): HTMLElement {
  const content = cmContent(text);
  return {
    querySelector: (selector: string) => (selector === ".cm-content" ? content : null),
    matches: () => false,
    getAttribute: () => null,
  } as unknown as HTMLElement;
}

class FakeXhr {
  static sentBodies: unknown[] = [];
  responseText = "";
  private readonly listeners: Array<{ type: string; fn: EventListener; once: boolean }> = [];

  open(_method?: string, _url?: string | URL): void {}

  send(body?: Document | XMLHttpRequestBodyInit | null): void {
    FakeXhr.sentBodies.push(body);
    this.dispatchLoad();
  }

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    if (typeof listener !== "function") return;
    const once = options === true || (typeof options === "object" && options.once === true);
    this.listeners.push({ type, fn: listener, once });
  }

  dispatchLoad(): void {
    for (const listener of this.listeners.filter((entry) => entry.type === "load")) {
      listener.fn.call(this, new Event("load"));
    }
  }
}

function installTabbedPage(
  cases: string[][],
  selected: number,
  options: {
    code?: string;
    initiallyMounted?: boolean;
    initiallyTabsMounted?: boolean;
    interpretIds?: Record<string, string>;
    storedLanguage?: string;
    domLanguage?: string;
  } = {},
): PageHarness {
  const snapshots: Array<{ payload: SnapshotPayload }> = [];
  let clearMessages = 0;
  const sentBodies: string[] = [];
  const listeners = new Map<string, Array<() => void>>();
  const timeouts = new Map<number, { fn: () => void; at: number }>();
  const rafs: FrameRequestCallback[] = [];
  let checkState = "SUCCESS";
  let checkStdout: string[] | undefined;
  let checkStdOutputList: string[] | undefined;
  const interpretId = "interp-1";
  const interpretIds = options.interpretIds ?? {};
  let mounted = options.initiallyMounted !== false;
  let tabsMounted = options.initiallyTabsMounted !== false && mounted;
  let nativeFetchCalls = 0;
  FakeXhr.sentBodies = [];

  let selectedIndex = selected;
  let tabClicks = 0;
  let now = 0;
  let nextTimerId = 1;
  let nextRafId = 1;

  function makeTab(index: number): HTMLElement {
    return {
      getAttribute: (name: string) => (name === "aria-selected" ? (selectedIndex === index ? "true" : "false") : null),
      click: () => {
        tabClicks += 1;
        selectedIndex = index;
        for (const listener of listeners.get("click") ?? []) listener();
      },
    } as unknown as HTMLElement;
  }

  const codeEditor = cmContent(options.code ?? "class Solution {};");
  const locationState = {
    pathname: "/problems/example/",
    origin: "https://leetcode.com",
  };
  const tabs = cases.map((_, index) => makeTab(index));
  const currentWrappers = (): HTMLElement[] =>
    mounted ? (cases[selectedIndex] ?? []).map(inputWrapper) : [];

  const fakeDocument = {
    querySelectorAll: (selector: string) => {
      if (selector === '[data-e2e-locator="console-testcase-tag"]') return tabsMounted ? tabs : [];
      if (selector === '[data-e2e-locator="console-testcase-input"]') return currentWrappers();
      if (selector === ".cm-content") {
        return [
          codeEditor,
          ...currentWrappers()
            .map((wrapper) => wrapper.querySelector(".cm-content"))
            .filter((node): node is HTMLElement => node !== null),
        ];
      }
      if (selector.includes("textarea")) return [];
      return [];
    },
    querySelector: (selector: string) =>
      selector.includes("headlessui-listbox-button") || selector === "button[data-state]"
        ? ({ textContent: options.domLanguage ?? "" } as HTMLElement)
        : null,
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (typeof listener !== "function") return;
      const bucket = listeners.get(type) ?? [];
      bucket.push(listener as () => void);
      listeners.set(type, bucket);
    },
    getElementById: () => null,
  };

  const pageMessages: Array<(event: MessageEvent) => void> = [];
  const fakeWindow = {
    postMessage: (message: { payload?: SnapshotPayload; type?: string }) => {
      if (message.type === "clear") {
        clearMessages += 1;
        return;
      }
      if (message.payload) snapshots.push({ payload: message.payload });
    },
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type !== "message" || typeof listener !== "function") return;
      pageMessages.push(listener as (event: MessageEvent) => void);
    },
    setInterval: () => 0,
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      nativeFetchCalls += 1;
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("interpret_solution") && typeof init?.body === "string") {
        sentBodies.push(init.body);
      }
      if (url.includes("interpret_solution")) {
        const requestBody = typeof init?.body === "string" ? JSON.parse(init.body) as { data_input?: string } : {};
        const responseId = (requestBody.data_input && interpretIds[requestBody.data_input]) ?? interpretId;
        return Promise.resolve(
          new Response(JSON.stringify({ interpret_id: responseId }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.includes("/check")) {
        const body: Record<string, unknown> = { state: checkState };
        if (checkStdout) body.code_output = checkStdout;
        if (checkStdOutputList) body.std_output_list = checkStdOutputList;
        return Promise.resolve(
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(new Response());
    },
    setTimeout: (fn: () => void, ms = 0) => {
      const id = nextTimerId++;
      timeouts.set(id, { fn, at: now + ms });
      return id;
    },
    clearTimeout: (id?: number) => {
      if (id !== undefined) timeouts.delete(id);
    },
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      rafs.push(callback);
      return nextRafId++;
    },
  };

  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("location", locationState);
  vi.stubGlobal("localStorage", {
    getItem: () => options.storedLanguage ?? JSON.stringify("cpp"),
  });
  class HarnessXhr extends FakeXhr {}
  vi.stubGlobal("XMLHttpRequest", HarnessXhr);

  async function flushCapture(): Promise<void> {
    let consecutiveRafs = 0;
    let idle = 0;
    for (let i = 0; i < 500; i += 1) {
      await Promise.resolve();
      const raf = rafs.shift();
      if (raf) {
        idle = 0;
        consecutiveRafs += 1;
        raf(now);
        if (consecutiveRafs > 6) {
          const next = earliestTimeout();
          if (next !== undefined) now = next;
          const dueWhileRaf = [...timeouts.entries()].filter(([, timer]) => timer.at <= now);
          for (const [id, timer] of dueWhileRaf) {
            timeouts.delete(id);
            timer.fn();
          }
        }
        continue;
      }
      consecutiveRafs = 0;
      const due = [...timeouts.entries()].filter(([, timer]) => timer.at <= now);
      if (due.length > 0) {
        idle = 0;
        for (const [id, timer] of due) {
          timeouts.delete(id);
          timer.fn();
        }
        continue;
      }
      const next = earliestTimeout();
      if (next !== undefined) {
        idle = 0;
        now = next;
        continue;
      }
      await Promise.resolve();
      idle += 1;
      if (rafs.length === 0 && timeouts.size === 0 && idle > 8) break;
    }
  }

  function earliestTimeout(): number | undefined {
    let next: number | undefined;
    for (const timer of timeouts.values()) {
      if (next === undefined || timer.at < next) next = timer.at;
    }
    return next;
  }

  return {
    snapshots,
    clearMessages: () => clearMessages,
    sentBodies,
    flushCapture,
    selectedIndex: () => selectedIndex,
    tabClicks: () => tabClicks,
    activate: () => {
      const message = pageHooksMessage(true);
      for (const listener of pageMessages) {
        listener({ data: message, origin: locationState.origin, source: fakeWindow } as unknown as MessageEvent);
      }
    },
    deactivate: () => {
      const message = pageHooksMessage(false);
      for (const listener of pageMessages) {
        listener({ data: message, origin: locationState.origin, source: fakeWindow } as unknown as MessageEvent);
      }
    },
    mountTestcases: () => {
      mounted = true;
      tabsMounted = true;
    },
    nativeFetchCalls: () => nativeFetchCalls,
    xhrBodies: () => FakeXhr.sentBodies,
    dispatchPageMessage: (data) => {
      const event = {
        data,
        origin: locationState.origin,
        source: fakeWindow,
      } as unknown as MessageEvent;
      for (const listener of pageMessages) listener(event);
    },
    setCheckState: (state: string) => {
      checkState = state;
    },
    setCheckStdout: (lines: string[] | undefined) => {
      checkStdout = lines;
    },
    setCheckStdOutputList: (entries: string[] | undefined) => {
      checkStdOutputList = entries;
    },
  };
}

const INTERPRET_ID = "interp-1";

async function finishRun(page: PageHarness, dataInput = "[1]"): Promise<void> {
  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: dataInput, typed_code: "class Solution {};", lang: "cpp" }),
  });
  await page.flushCapture();
  await window.fetch(`https://leetcode.com/submissions/detail/${INTERPRET_ID}/check/`);
  await page.flushCapture();
}

test("walks case tabs after Run results succeed, not on load or send", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"], ["[3]"]], 1);
  await import("./inject.js");
  page.activate();
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]", "[3]"]);

  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[1]", typed_code: "class Solution {};", lang: "cpp" }),
  });
  await page.flushCapture();
  expect(page.snapshots).toHaveLength(1);

  await window.fetch(`https://leetcode.com/submissions/detail/${INTERPRET_ID}/check/`);
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]", "[3]"]);
  expect(page.selectedIndex()).toBe(1);
});

test("falls back to the DOM language when stored language is not a string", async () => {
  const page = installTabbedPage([["[1]"]], 0, {
    storedLanguage: JSON.stringify({ value: "python3" }),
    domLanguage: "Python3",
  });
  await import("./inject.js");
  page.activate();
  await page.flushCapture();

  expect(page.snapshots.at(-1)?.payload.lang).toBe("python3");
});

test("does not walk while a Run check is still in flight", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0);
  await import("./inject.js");
  page.activate();
  await page.flushCapture();
  page.snapshots.length = 0;
  page.setCheckState("PENDING");
  await finishRun(page);
  expect(page.snapshots).toEqual([]);

  page.setCheckState("SUCCESS");
  await window.fetch(`https://leetcode.com/submissions/detail/${INTERPRET_ID}/check/`);
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]"]);
});

test("publishes one atomic snapshot containing every visited Case tab", async () => {
  const page = installTabbedPage([["[1]"], ["[2]", "4"], ["[3]"]], 1);
  await import("./inject.js");
  page.activate();
  await page.flushCapture();
  await finishRun(page);
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]\n4", "[3]"]);
});

test("forwards Run stdout and per-case stdout from the check response", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0);
  page.setCheckStdout(["#graphy current n0"]);
  page.setCheckStdOutputList(["#graphy current n0", "#graphy topology n0:n2,-"]);
  await import("./inject.js");
  page.activate();
  await page.flushCapture();
  await finishRun(page);

  expect(page.snapshots.at(-1)?.payload.stdout).toBe("#graphy current n0");
  expect(page.snapshots.at(-1)?.payload.stdoutByCase).toEqual([
    "#graphy current n0",
    "#graphy topology n0:n2,-",
  ]);
});

const PYTHON_TYPED = "class Solution:\n    def invertTree(self, root):\n        return root\n";

test("appends a Python tracer on Run only after tracing is enabled", async () => {
  const page = installTabbedPage([["[4,2,7]"]], 0, { code: PYTHON_TYPED });
  await import("./inject.js");
  page.activate();
  await page.flushCapture();

  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[4,2,7]", typed_code: PYTHON_TYPED, lang: "python3" }),
  });
  expect(JSON.parse(page.sentBodies.at(-1) ?? "{}").typed_code).toBe(PYTHON_TYPED);

  page.dispatchPageMessage(pageTraceMessage(true));
  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[4,2,7]", typed_code: PYTHON_TYPED, lang: "python3" }),
  });
  expect(JSON.parse(page.sentBodies.at(-1) ?? "{}").typed_code).toContain("GRAPHY_TRACE_V1");
  await page.flushCapture();
  await window.fetch(`https://leetcode.com/submissions/detail/${INTERPRET_ID}/check/`);
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.code).toBe(PYTHON_TYPED);
});

test("waits for testcase tabs before publishing the initial snapshot", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0, { initiallyMounted: false });
  await import("./inject.js");
  page.activate();
  await Promise.resolve();
  expect(page.snapshots).toEqual([]);

  page.mountTestcases();
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]"]);
});

test("does not publish from an input editor before the official testcase tabs mount", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0, { initiallyTabsMounted: false });
  await import("./inject.js");
  page.activate();
  await Promise.resolve();
  expect(page.snapshots).toEqual([]);

  page.mountTestcases();
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]"]);
});

test("publishes the initial testcase snapshot before a Run result can supersede it", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0, { initiallyMounted: false });
  await import("./inject.js");
  page.activate();
  await Promise.resolve();

  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[run]", typed_code: "class Solution {};", lang: "cpp" }),
  });
  await window.fetch(`https://leetcode.com/submissions/detail/${INTERPRET_ID}/check/`);
  page.mountTestcases();
  await page.flushCapture();

  expect(page.snapshots.map(({ payload }) => payload.source)).toEqual(["editor", "network"]);
  expect(page.snapshots[0]?.payload.cases).toEqual(["[1]", "[2]"]);
});

test("does not patch or capture Run requests while hooks are inactive", async () => {
  const page = installTabbedPage([["[1]"]], 0);
  const pythonCode = "class Solution:\n    def solve(self, root):\n        return root\n";
  await import("./inject.js");

  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[1]", typed_code: pythonCode, lang: "python3" }),
  });
  expect(page.nativeFetchCalls()).toBe(1);
  expect(JSON.parse(page.sentBodies.at(-1) ?? "{}").typed_code).toBe(pythonCode);

  page.activate();
  page.dispatchPageMessage(pageTraceMessage(true));
  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[1]", typed_code: pythonCode, lang: "python3" }),
  });
  expect(JSON.parse(page.sentBodies.at(-1) ?? "{}").typed_code).toContain("GRAPHY_TRACE_V1");
  page.deactivate();
  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[1]", typed_code: pythonCode, lang: "python3" }),
  });
  expect(JSON.parse(page.sentBodies.at(-1) ?? "{}").typed_code).toBe(pythonCode);
  expect(page.nativeFetchCalls()).toBe(3);

  const rawBody = JSON.stringify({ data_input: "[1]", typed_code: pythonCode, lang: "python3" });
  expect(XMLHttpRequest.prototype.send).toBe(FakeXhr.prototype.send);
  const xhr = new XMLHttpRequest();
  xhr.open("POST", "https://leetcode.com/problems/example/interpret_solution/");
  xhr.send(rawBody);
  expect(page.xhrBodies().at(-1)).toBe(rawBody);
});

test("keeps concurrent Run overrides paired with their result IDs", async () => {
  const page = installTabbedPage([], 0, {
    interpretIds: { "[1]": "interp-a", "[2]": "interp-b" },
    initiallyMounted: false,
  });
  await import("./inject.js");
  page.activate();
  await page.flushCapture();

  await Promise.all([
    window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
      method: "POST",
      body: JSON.stringify({ data_input: "[1]", typed_code: "class Solution {};", lang: "cpp" }),
    }),
    window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
      method: "POST",
      body: JSON.stringify({ data_input: "[2]", typed_code: "class Solution {};", lang: "cpp" }),
    }),
  ]);
  await window.fetch("https://leetcode.com/submissions/detail/interp-a/check/");
  await page.flushCapture();
  await window.fetch("https://leetcode.com/submissions/detail/interp-b/check/");
  await page.flushCapture();

  expect(page.snapshots.map(({ payload }) => payload.cases)).toEqual([["[1]"], ["[2]"]]);
});

test("does not retain more than the bounded number of pending Run correlations", async () => {
  const page = installTabbedPage([["[1]"]], 0);
  await import("./inject.js");
  page.activate();
  await page.flushCapture();
  page.snapshots.length = 0;

  for (let index = 0; index < 40; index += 1) {
    await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
      method: "POST",
      body: JSON.stringify({ data_input: `[${index}]`, typed_code: "class Solution {};", lang: "cpp" }),
    });
  }
  await window.fetch("https://leetcode.com/submissions/detail/interp-1/check/");
  await page.flushCapture();
  expect(page.snapshots.length).toBeLessThanOrEqual(1);
});

test("publishes a clear message when hooks deactivate", async () => {
  const page = installTabbedPage([["[1]"]], 0);
  await import("./inject.js");
  page.activate();
  await page.flushCapture();
  page.deactivate();
  expect(page.clearMessages()).toBe(1);
  expect(pageClearMessage()).toEqual({ channel: "graphy:page", type: "clear" });
});
