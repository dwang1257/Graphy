import { afterEach, expect, test, vi } from "vitest";

interface PageHarness {
  snapshots: Array<{ payload: SnapshotPayload }>;
  sentBodies: string[];
  flushCapture(): Promise<void>;
  selectedIndex(): number;
  tabClicks(): number;
  pauseSelectionOf(index: number): void;
  dispatchInput(): void;
  dispatchClick(): void;
  setPathname(pathname: string): void;
  whenSelected(index: number, fn: () => void): void;
  unmountConsole(): void;
  setCheckState(state: string): void;
  setCheckStdout(lines: string[] | undefined): void;
}

interface SnapshotPayload {
  cases: string[];
  captureError?: string;
  source: string;
  slug?: string;
  code?: string;
  stdout?: string;
}

interface TabbedPageOptions {
  code?: string;
  mounted?: string[];
  pathname?: string;
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

  private readonly listeners: Array<{
    type: string;
    fn: EventListener;
    once: boolean;
  }> = [];

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
      if (listener.once) {
        const index = this.listeners.indexOf(listener);
        if (index >= 0) this.listeners.splice(index, 1);
      }
    }
  }
}

function installTabbedPage(
  cases: string[][],
  selected: number,
  options: TabbedPageOptions = {},
): PageHarness {
  const snapshots: Array<{ payload: SnapshotPayload }> = [];
  const sentBodies: string[] = [];
  const listeners = new Map<string, Array<() => void>>();
  const timeouts = new Map<number, { fn: () => void; at: number }>();
  const rafs: FrameRequestCallback[] = [];
  let checkState = "SUCCESS";
  let checkStdout: string[] | undefined;
  const interpretId = "interp-1";

  let selectedIndex = selected;
  let tabClicks = 0;
  let paused: number | null = null;
  let now = 0;
  let nextTimerId = 1;
  let nextRafId = 1;
  const onceSelected: Array<{ index: number; fn: () => void; fired: boolean }> = [];

  function makeTab(index: number): HTMLElement {
    return {
      getAttribute: (name: string) => {
        if (name === "aria-selected") return selectedIndex === index ? "true" : "false";
        return null;
      },
      click: () => {
        tabClicks += 1;
        selectedIndex = index;
        for (const listener of listeners.get("click") ?? []) listener();
        for (const hook of onceSelected) {
          if (hook.fired || hook.index !== index) continue;
          hook.fired = true;
          hook.fn();
        }
      },
    } as unknown as HTMLElement;
  }

  const codeText = options.code ?? "class Solution {};";
  const codeEditor = cmContent(codeText);
  const locationState = {
    pathname: options.pathname ?? "/problems/example/",
    origin: "https://leetcode.com",
  };

  const tabs = cases.map((_, index) => makeTab(index));

  const mountedWrappers = (options.mounted ?? []).map(inputWrapper);

  const currentWrappers = (): HTMLElement[] => {
    if (paused !== null && selectedIndex === paused) return [];
    if (tabs.length === 0) return mountedWrappers;
    return (cases[selectedIndex] ?? []).map(inputWrapper);
  };

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

  const fakeWindow = {
    postMessage: (message: { payload: SnapshotPayload }) => {
      snapshots.push(message);
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
    pauseSelectionOf: (index: number) => {
      paused = index;
    },
    dispatchInput: () => {
      for (const listener of listeners.get("input") ?? []) listener();
    },
    dispatchClick: () => {
      for (const listener of listeners.get("click") ?? []) listener();
    },
    setPathname: (pathname: string) => {
      locationState.pathname = pathname;
    },
    whenSelected: (index: number, fn: () => void) => {
      onceSelected.push({ index, fn, fired: false });
    },
    unmountConsole: () => {
      tabs.splice(0, tabs.length);
      mountedWrappers.splice(0, mountedWrappers.length);
    },
    setCheckState: (state: string) => {
      checkState = state;
    },
    setCheckStdout: (lines: string[] | undefined) => {
      checkStdout = lines;
    },
  };
}

const INTERPRET_ID = "interp-1";

async function runCode(dataInput = "[1]"): Promise<void> {
  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: dataInput, typed_code: "class Solution {};", lang: "cpp" }),
  });
}

async function finishCheck(id = INTERPRET_ID): Promise<void> {
  await window.fetch(`https://leetcode.com/submissions/detail/${id}/check/`);
}

async function finishRun(page: PageHarness, dataInput = "[1]"): Promise<void> {
  await runCode(dataInput);
  await page.flushCapture();
  await finishCheck();
  await page.flushCapture();
}

class ResultNode {
  tagName: string;
  attributes: Record<string, string>;
  className: string;
  childNodes: ResultNode[];
  parentElement: ResultNode | null = null;
  text: string;
  onClick?: () => void;

  constructor(options: {
    tag?: string;
    attributes?: Record<string, string>;
    className?: string;
    text?: string;
    children?: ResultNode[];
    onClick?: () => void;
  } = {}) {
    this.tagName = (options.tag ?? "div").toUpperCase();
    this.attributes = options.attributes ?? {};
    this.className = options.className ?? "";
    this.text = options.text ?? "";
    this.childNodes = options.children ?? [];
    this.onClick = options.onClick;
    for (const child of this.childNodes) child.parentElement = this;
  }

  get children(): ResultNode[] {
    return this.childNodes;
  }

  get textContent(): string {
    return `${this.childNodes.map((child) => child.textContent).join("")}${this.text}`;
  }

  get nextElementSibling(): ResultNode | null {
    if (!this.parentElement) return null;
    const siblings = this.parentElement.childNodes;
    const index = siblings.indexOf(this);
    return index >= 0 ? (siblings[index + 1] ?? null) : null;
  }

  click(): void {
    this.onClick?.();
  }

  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }

  matches(selector: string): boolean {
    return selector.split(",").some((part) => resultMatches(this, part.trim()));
  }

  contains(other: ResultNode): boolean {
    let node: ResultNode | null = other;
    while (node) {
      if (node === this) return true;
      node = node.parentElement;
    }
    return false;
  }

  querySelector(selector: string): ResultNode | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): ResultNode[] {
    const found: ResultNode[] = [];
    const visit = (node: ResultNode): void => {
      if (node.matches(selector)) found.push(node);
      for (const child of node.childNodes) visit(child);
    };
    for (const child of this.childNodes) visit(child);
    return found;
  }
}

function resultMatches(node: ResultNode, selector: string): boolean {
  const attr = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
  if (attr) return node.getAttribute(attr[1]!) === attr[2];
  if (selector.startsWith(".")) return node.className.split(/\s+/).includes(selector.slice(1));
  return node.tagName === selector.toUpperCase();
}

function installResultPage(options: { cases: string[][]; selected: number }): PageHarness {
  const page = installTabbedPage([], options.selected, { code: "class Solution {};" });
  let selectedIndex = options.selected;

  const inputValues = (): ResultNode[] =>
    (options.cases[selectedIndex] ?? []).map(
      (value) =>
        new ResultNode({
          children: [new ResultNode({ className: "font-menlo whitespace-pre-wrap", text: value })],
        }),
    );

  const heading = new ResultNode({ className: "mb-2 text-xs font-medium", text: "Input" });
  const section = new ResultNode({ className: "space-y-2", children: inputValues() });
  const pills = options.cases.map((_, index) => {
    return new ResultNode({
      className: `cursor-pointer rounded-lg px-4 py-1 font-medium${
        index === selectedIndex ? " bg-fill-3" : ""
      }`,
      onClick: () => {
        selectedIndex = index;
        section.childNodes.splice(0, section.childNodes.length, ...inputValues());
        for (const child of section.childNodes) child.parentElement = section;
        for (const [pillIndex, pill] of pills.entries()) {
          pill.className = `cursor-pointer rounded-lg px-4 py-1 font-medium${
            pillIndex === selectedIndex ? " bg-fill-3" : ""
          }`;
        }
      },
      children: [new ResultNode({ text: `Case ${index + 1}` })],
    });
  });

  const panel = new ResultNode({
    className: "mx-5 my-4 space-y-4",
    children: [
      new ResultNode({ attributes: { "data-e2e-locator": "console-result" }, text: "Accepted" }),
      new ResultNode({ className: "flex flex-wrap", children: pills }),
      new ResultNode({ children: [heading, section] }),
    ],
  });
  const root = new ResultNode({ children: [panel] });

  const originalDocument = document as unknown as {
    querySelector: (selector: string) => unknown;
    querySelectorAll: (selector: string) => unknown;
  };
  const previousAll = originalDocument.querySelectorAll.bind(originalDocument);
  const previousOne = originalDocument.querySelector.bind(originalDocument);

  originalDocument.querySelector = (selector: string) =>
    root.querySelector(selector) ?? previousOne(selector);
  originalDocument.querySelectorAll = (selector: string) => {
    if (selector === '[data-e2e-locator="console-testcase-tag"]') return [];
    if (selector === '[data-e2e-locator="console-testcase-input"]') return [];
    if (selector === ".cm-content") return previousAll(selector);
    const fromTree = root.querySelectorAll(selector);
    return fromTree.length > 0 ? fromTree : previousAll(selector);
  };

  return {
    ...page,
    selectedIndex: () => selectedIndex,
  };
}

test("walks case tabs after Run results succeed, not on load or send", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"], ["[3]"]], 1);
  await import("./inject.js");
  await page.flushCapture();
  expect(page.tabClicks()).toBe(0);
  expect(page.snapshots).toEqual([]);

  await runCode("[1]");
  await page.flushCapture();
  expect(page.tabClicks()).toBe(0);
  expect(page.snapshots).toEqual([]);

  await finishCheck();
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]", "[3]"]);
  const clicksAfterResults = page.tabClicks();
  expect(clicksAfterResults).toBeGreaterThan(0);
  expect(page.selectedIndex()).toBe(1);

  page.dispatchInput();
  page.dispatchClick();
  await page.flushCapture();
  expect(page.tabClicks()).toBe(clicksAfterResults);
});

test("does not walk while a Run check is still in flight", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0);
  await import("./inject.js");

  page.setCheckState("PENDING");
  await runCode("[1]");
  await page.flushCapture();
  await finishCheck();
  await page.flushCapture();
  expect(page.tabClicks()).toBe(0);
  expect(page.snapshots).toEqual([]);

  page.setCheckState("STARTED");
  await finishCheck();
  await page.flushCapture();
  expect(page.tabClicks()).toBe(0);
  expect(page.snapshots).toEqual([]);

  page.setCheckState("SUCCESS");
  await finishCheck();
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]"]);
});

test("ignores a check for a different submission id", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0);
  await import("./inject.js");
  await runCode("[1]");
  await page.flushCapture();
  await finishCheck("other-id");
  await page.flushCapture();
  expect(page.tabClicks()).toBe(0);
  expect(page.snapshots).toEqual([]);
});

test("publishes one atomic snapshot containing every visited Case tab", async () => {
  const page = installTabbedPage([["[1]"], ["[2]", "4"], ["[3]"]], 1);
  await import("./inject.js");
  await finishRun(page);
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]\n4", "[3]"]);
  expect(page.selectedIndex()).toBe(1);
});

function isSubsetCollection(cases: string[] | undefined, complete: string[]): boolean {
  return !!cases && cases.length > 0 && cases.length < complete.length;
}

test("keeps the last complete collection when a later Run cannot walk cases", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"], ["[3]"]], 1);
  await import("./inject.js");
  await finishRun(page);
  const complete = page.snapshots.at(-1)?.payload.cases ?? [];
  const clicksAfterFirst = page.tabClicks();

  page.pauseSelectionOf(0);
  await finishRun(page, "[2]");

  expect(complete).toEqual(["[1]", "[2]", "[3]"]);
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(complete);
  expect(page.tabClicks()).toBeGreaterThan(clicksAfterFirst);
  expect(page.selectedIndex()).toBe(1);
});

test("does not post a subset while walking cases after results", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"], ["[3]"]], 1);
  await import("./inject.js");
  await finishRun(page);

  const complete = ["[1]", "[2]", "[3]"];
  expect(page.snapshots.some((snapshot) => isSubsetCollection(snapshot.payload.cases, complete))).toBe(
    false,
  );
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(complete);
  expect(page.selectedIndex()).toBe(1);
});

test("Run never replaces a complete collection with data_input", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"], ["[3]"]], 0);
  await import("./inject.js");
  await finishRun(page);
  await finishRun(page, "[2]");

  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]", "[3]"]);
});

test("clears the last complete cache when the problem slug changes", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0);
  await import("./inject.js");
  await finishRun(page);
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]"]);

  page.setPathname("/problems/other/");
  page.unmountConsole();
  await finishRun(page, "[9]");

  expect(page.snapshots.at(-1)?.payload.slug).toBe("other");
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[9]"]);
});

test("does not publish when the problem slug changes during an async walk", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0);
  await import("./inject.js");
  page.whenSelected(1, () => {
    page.setPathname("/problems/other/");
  });
  await finishRun(page);

  expect(page.snapshots).toEqual([]);
});

test("publishes empty cases and captureError when the first traversal fails", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0);
  page.pauseSelectionOf(0);
  await import("./inject.js");
  await finishRun(page);

  expect(page.snapshots.at(-1)?.payload.cases).toEqual([]);
  expect(page.snapshots.at(-1)?.payload.captureError).toBeDefined();
});

test("publishes one mounted case when no Case tabs exist", async () => {
  const page = installTabbedPage([], -1, { mounted: ["[1,2,3]", "2"] });
  await import("./inject.js");
  await finishRun(page);

  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1,2,3]\n2"]);
});

test("keeps the cached collection when a later capture finds no tabs or inputs", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"], ["[3]"]], 0);
  await import("./inject.js");
  await finishRun(page);
  const complete = page.snapshots.at(-1)?.payload.cases;
  expect(complete).toEqual(["[1]", "[2]", "[3]"]);

  page.unmountConsole();
  await finishRun(page, "[2]");

  expect(page.snapshots.at(-1)?.payload.cases).toEqual(complete);
  expect(page.snapshots.at(-1)?.payload.captureError).toBeUndefined();

  page.dispatchInput();
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(complete);
  expect(page.snapshots.at(-1)?.payload.captureError).toBeUndefined();
});

test("Run may use data_input only when no tabs and no complete cache exist", async () => {
  const page = installTabbedPage([], -1);
  await import("./inject.js");
  await page.flushCapture();
  expect(page.snapshots).toEqual([]);

  await finishRun(page, "[2]");

  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[2]"]);
});

test("publishes every Test Result case from the Input section", async () => {
  const page = installResultPage({
    cases: [
      ["[2,7,11,15]", "9"],
      ["[3,2,4]", "6"],
      ["[3,3]", "6"],
    ],
    selected: 0,
  });
  await import("./inject.js");
  await finishRun(page);

  expect(page.snapshots.at(-1)?.payload.cases).toEqual([
    "[2,7,11,15]\n9",
    "[3,2,4]\n6",
    "[3,3]\n6",
  ]);
  expect(page.selectedIndex()).toBe(0);
});

test("forwards Run stdout from the check response", async () => {
  const page = installTabbedPage([["[1]"]], 0);
  page.setCheckStdout(["#graphy current n0", "#graphy visit n0"]);
  await import("./inject.js");
  await finishRun(page);

  expect(page.snapshots.at(-1)?.payload.stdout).toBe("#graphy current n0\n#graphy visit n0");
  expect(page.snapshots.at(-1)?.payload.source).toBe("network");
});

test("appends a Python tracer on Run but snapshots the editor code", async () => {
  const page = installTabbedPage([["[4,2,7]"]], 0, {
    code: "class Solution:\n    def invertTree(self, root):\n        return root\n",
  });
  await import("./inject.js");
  const typed = "class Solution:\n    def invertTree(self, root):\n        return root\n";
  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[4,2,7]", typed_code: typed, lang: "python3" }),
  });
  await page.flushCapture();
  await finishCheck();
  await page.flushCapture();

  const sent = JSON.parse(page.sentBodies.at(-1) ?? "{}") as { typed_code?: string };
  expect(sent.typed_code).toContain("GRAPHY_TRACE_V1");
  expect(page.snapshots.at(-1)?.payload.code).toBe(typed);
  expect(page.snapshots.at(-1)?.payload.code).not.toContain("GRAPHY_TRACE_V1");
});

test("XHR load skips parsing unrelated URLs but still walks check results", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0);
  await import("./inject.js");

  const parseSpy = vi.spyOn(JSON, "parse");
  const unrelated = new FakeXhr();
  unrelated.open("GET", "https://leetcode.com/graphql");
  unrelated.responseText = "not-json{{{";
  expect(() => unrelated.send()).not.toThrow();
  expect(parseSpy).not.toHaveBeenCalledWith("not-json{{{");
  parseSpy.mockRestore();

  const run = new FakeXhr();
  run.open("POST", "https://leetcode.com/problems/example/interpret_solution/");
  run.responseText = JSON.stringify({ interpret_id: INTERPRET_ID });
  run.send(JSON.stringify({ data_input: "[1]", typed_code: "class Solution {};", lang: "cpp" }));

  const check = new FakeXhr();
  check.open("GET", `https://leetcode.com/submissions/detail/${INTERPRET_ID}/check/`);
  check.responseText = JSON.stringify({ state: "SUCCESS" });
  check.send();
  await page.flushCapture();

  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]"]);
});
