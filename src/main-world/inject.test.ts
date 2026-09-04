import { afterEach, expect, test, vi } from "vitest";

interface SnapshotPayload {
  cases: string[];
  captureError?: string;
  source: string;
  slug?: string;
  code?: string;
}

interface PageHarness {
  snapshots: Array<{ payload: SnapshotPayload }>;
  flushCapture(): Promise<void>;
  selectedIndex(): number;
  pauseSelectionOf(index: number): void;
  dispatchInput(): void;
  setPathname(pathname: string): void;
  whenSelected(index: number, fn: () => void): void;
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

function installTabbedPage(
  cases: string[][],
  selected: number,
  options: TabbedPageOptions = {},
): PageHarness {
  const snapshots: Array<{ payload: SnapshotPayload }> = [];
  const listeners = new Map<string, Array<() => void>>();
  const timeouts = new Map<number, { fn: () => void; at: number }>();
  const rafs: FrameRequestCallback[] = [];

  let selectedIndex = selected;
  let paused: number | null = null;
  let now = 0;
  let nextTimerId = 1;
  let nextRafId = 1;
  const onceSelected: Array<{ index: number; fn: () => void; fired: boolean }> = [];

  const codeText = options.code ?? "class Solution {};";
  const codeEditor = cmContent(codeText);
  const locationState = {
    pathname: options.pathname ?? "/problems/example/",
    origin: "https://leetcode.com",
  };

  const tabs = cases.map((_, index) => {
    return {
      getAttribute: (name: string) => {
        if (name === "aria-selected") return selectedIndex === index ? "true" : "false";
        return null;
      },
      click: () => {
        if (paused !== index) selectedIndex = index;
        for (const listener of listeners.get("click") ?? []) listener();
        for (const hook of onceSelected) {
          if (hook.fired || hook.index !== index) continue;
          hook.fired = true;
          hook.fn();
        }
      },
    } as unknown as HTMLElement;
  });

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
    fetch: () => Promise.resolve(new Response()),
    postMessage: (message: { payload: SnapshotPayload }) => {
      snapshots.push(message);
    },
    setInterval: () => 0,
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

  class FakeXhr {
    open(): void {}
    send(): void {}
  }

  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("location", locationState);
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify("cpp") });
  vi.stubGlobal("XMLHttpRequest", FakeXhr);

  async function flushCapture(): Promise<void> {
    let consecutiveRafs = 0;
    for (let i = 0; i < 500; i += 1) {
      await Promise.resolve();

      const raf = rafs.shift();
      if (raf) {
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
        for (const [id, timer] of due) {
          timeouts.delete(id);
          timer.fn();
        }
        continue;
      }

      const next = earliestTimeout();
      if (next !== undefined) {
        now = next;
        continue;
      }

      await Promise.resolve();
      if (rafs.length === 0 && timeouts.size === 0) break;
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
    flushCapture,
    selectedIndex: () => selectedIndex,
    pauseSelectionOf: (index: number) => {
      paused = index;
    },
    dispatchInput: () => {
      for (const listener of listeners.get("input") ?? []) listener();
    },
    setPathname: (pathname: string) => {
      locationState.pathname = pathname;
    },
    whenSelected: (index: number, fn: () => void) => {
      onceSelected.push({ index, fn, fired: false });
    },
  };
}

test("publishes one atomic snapshot containing every visited Case tab", async () => {
  const page = installTabbedPage([["[1]"], ["[2]", "4"], ["[3]"]], 1);
  await import("./inject.js");
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]\n4", "[3]"]);
  expect(page.selectedIndex()).toBe(1);
});

function isSubsetCollection(cases: string[] | undefined, complete: string[]): boolean {
  return !!cases && cases.length > 0 && cases.length < complete.length;
}

test("keeps the last complete collection when a refresh is cancelled", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"], ["[3]"]], 1);
  await import("./inject.js");
  await page.flushCapture();
  const complete = page.snapshots.at(-1)?.payload.cases ?? [];

  page.whenSelected(0, () => {
    page.dispatchInput();
  });
  page.dispatchInput();
  await page.flushCapture();

  expect(complete).toEqual(["[1]", "[2]", "[3]"]);
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(complete);
  expect(page.snapshots.some((snapshot) => isSubsetCollection(snapshot.payload.cases, complete))).toBe(
    false,
  );
  expect(page.selectedIndex()).toBe(1);
});

test("does not post a subset when a second generation starts mid-traversal", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"], ["[3]"]], 1);
  await import("./inject.js");
  await page.flushCapture();
  const complete = page.snapshots.at(-1)?.payload.cases ?? [];
  const posted = page.snapshots.length;

  page.whenSelected(0, () => {
    void window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
      method: "POST",
      body: JSON.stringify({ data_input: "[2]", typed_code: "class Solution {};", lang: "cpp" }),
    });
  });
  page.dispatchInput();
  await page.flushCapture();

  const extra = page.snapshots.slice(posted);
  expect(complete).toEqual(["[1]", "[2]", "[3]"]);
  expect(extra.some((snapshot) => isSubsetCollection(snapshot.payload.cases, complete))).toBe(false);
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(complete);
  expect(page.selectedIndex()).toBe(1);
});

test("Run never replaces a complete collection with data_input", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"], ["[3]"]], 0);
  await import("./inject.js");
  await page.flushCapture();

  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[2]", typed_code: "class Solution {};", lang: "cpp" }),
  });
  await page.flushCapture();

  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]", "[3]"]);
});

test("clears the last complete cache when the problem slug changes", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0);
  await import("./inject.js");
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1]", "[2]"]);

  page.setPathname("/problems/other/");
  page.pauseSelectionOf(0);
  page.dispatchInput();
  await page.flushCapture();

  expect(page.snapshots.at(-1)?.payload.slug).toBe("other");
  expect(page.snapshots.at(-1)?.payload.cases).toEqual([]);
  expect(page.snapshots.at(-1)?.payload.captureError).toBeDefined();
});

test("publishes empty cases and captureError when the first traversal fails", async () => {
  const page = installTabbedPage([["[1]"], ["[2]"]], 0);
  page.pauseSelectionOf(0);
  await import("./inject.js");
  await page.flushCapture();

  expect(page.snapshots.at(-1)?.payload.cases).toEqual([]);
  expect(page.snapshots.at(-1)?.payload.captureError).toBeDefined();
});

test("publishes one mounted case when no Case tabs exist", async () => {
  const page = installTabbedPage([], -1, { mounted: ["[1,2,3]", "2"] });
  await import("./inject.js");
  await page.flushCapture();

  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[1,2,3]\n2"]);
});

test("Run may use data_input only when no tabs and no complete cache exist", async () => {
  const page = installTabbedPage([], -1);
  await import("./inject.js");
  await page.flushCapture();
  expect(page.snapshots.at(-1)?.payload.cases).toEqual([]);

  await window.fetch("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({ data_input: "[2]", typed_code: "class Solution {};", lang: "cpp" }),
  });
  await page.flushCapture();

  expect(page.snapshots.at(-1)?.payload.cases).toEqual(["[2]"]);
});
