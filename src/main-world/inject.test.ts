import { afterEach, expect, test, vi } from "vitest";

import { pageTraceMessage } from "../shared/protocol.js";

interface PageHarness {
  snapshots: Array<{ payload: SnapshotPayload }>;
  sentBodies: string[];
  flushCapture(): Promise<void>;
  selectedIndex(): number;
  tabClicks(): number;
  dispatchPageMessage(data: unknown): void;
  setCheckState(state: string): void;
  setCheckStdout(lines: string[] | undefined): void;
  setCheckStdOutputList(entries: string[] | undefined): void;
}

interface SnapshotPayload {
  cases: string[];
  source: string;
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
  responseText = "";
  private readonly listeners: Array<{ type: string; fn: EventListener; once: boolean }> = [];

  open(_method?: string, _url?: string | URL): void {}

  send(_body?: Document | XMLHttpRequestBodyInit | null): void {
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
  options: { code?: string } = {},
): PageHarness {
  const snapshots: Array<{ payload: SnapshotPayload }> = [];
  const sentBodies: string[] = [];
  const listeners = new Map<string, Array<() => void>>();
  const timeouts = new Map<number, { fn: () => void; at: number }>();
  const rafs: FrameRequestCallback[] = [];
  let checkState = "SUCCESS";
  let checkStdout: string[] | undefined;
  let checkStdOutputList: string[] | undefined;
  const interpretId = "interp-1";

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
  const currentWrappers = (): HTMLElement[] => (cases[selectedIndex] ?? []).map(inputWrapper);

  const fakeDocument = {
    querySelectorAll: (selector: string) => {
      if (selector === '[data-e2e-locator="console-testcase-tag"]') return tabs;
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
    querySelector: () => null,
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
    postMessage: (message: { payload: SnapshotPayload }) => {
      snapshots.push(message);
    },
    addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => {
      if (type !== "message" || typeof listener !== "function") return;
      pageMessages.push(listener as (event: MessageEvent) => void);
    },
    setInterval: () => 0,
    fetch: (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("interpret_solution") && typeof init?.body === "string") {
        sentBodies.push(init.body);
      }
      if (url.includes("interpret_solution")) {
        return Promise.resolve(
          new Response(JSON.stringify({ interpret_id: interpretId }), {
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
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify("cpp") });
  vi.stubGlobal("XMLHttpRequest", FakeXhr);

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
    sentBodies,
    flushCapture,
    selectedIndex: () => selectedIndex,
    tabClicks: () => tabClicks,
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
  await page.flushCapture();
  expect(page.tabClicks()).toBe(0);

  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[1]", typed_code: "class Solution {};", lang: "cpp" }),
  });
  await page.flushCapture();
  expect(page.snapshots).toEqual([]);

  await window.fetch(`https://leetcode.com/submissions/detail/${INTERPRET_ID}/check/`);
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]", "[3]"]);
  expect(page.selectedIndex()).toBe(1);
});

test("does not walk while a Run check is still in flight", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0);
  await import("./inject.js");
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
  await finishRun(page);
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]\n4", "[3]"]);
});

test("forwards Run stdout and per-case stdout from the check response", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0);
  page.setCheckStdout(["#graphy current n0"]);
  page.setCheckStdOutputList(["#graphy current n0", "#graphy topology n0:n2,-"]);
  await import("./inject.js");
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
