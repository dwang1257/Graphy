import { afterEach, expect, test, vi } from "vitest";

interface FakeEditor extends HTMLElement {
  locator?: string;
  cmView: {
    rootView: {
      view: {
        state: {
          doc: { toString(): string };
        };
      };
    };
  };
}

function editor(text: string, locator?: string): FakeEditor {
  const node = {
    locator,
    closest(selector: string) {
      if (!locator) return null;
      const exact = selector.match(/^\[data-e2e-locator="([^"]+)"\]$/);
      if (exact) return exact[1] === locator ? node : null;
      const contains = selector.match(/^\[data-e2e-locator\*="([^"]+)"\]$/);
      if (contains) return contains[1] !== undefined && locator.includes(contains[1]) ? node : null;
      return null;
    },
    cmView: {
      rootView: {
        view: {
          state: {
            doc: { toString: () => text },
          },
        },
      },
    },
  };
  return node as FakeEditor;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

const TREE_CODE = "class Solution { public: TreeNode* invertTree(TreeNode* root) { return root; } };";

function installPage(options: {
  code?: string;
  buffer?: string;
  buffers?: Array<string | { text: string; locator?: string }>;
  resultBefore?: string[];
  resultAfter?: string[];
  caseTags?: number;
  paramFields?: number;
  textareas?: string[];
}): {
  snapshots: Array<{ payload: { cases: string[]; code: string; captureError?: string; source: string } }>;
  cmEditors: FakeEditor[];
  fireInput: () => void;
} {
  const snapshots: Array<{ payload: { cases: string[]; code: string; captureError?: string; source: string } }> = [];
  const testcaseBuffers = options.buffers ?? (options.buffer !== undefined ? [options.buffer] : []);
  const asEditor = (item: string | { text: string; locator?: string }, fallbackLocator?: string) =>
    typeof item === "string" ? editor(item, fallbackLocator) : editor(item.text, item.locator);

  const cmEditors = [
    ...(options.code !== undefined ? [editor(options.code)] : []),
    ...(options.resultBefore ?? []).map((text) => editor(text, "console-result")),
    ...testcaseBuffers.map((item) => asEditor(item)),
    ...(options.resultAfter ?? []).map((text) => editor(text, "console-result")),
  ];
  const caseTags = Array.from({ length: options.caseTags ?? 0 }, (_, i) => ({
    textContent: `Case ${i + 1}`,
  }));
  const paramFields = Array.from({ length: options.paramFields ?? 0 }, () => ({}));
  const textareas = (options.textareas ?? []).map((value) => ({ value }));
  const listeners: Record<string, () => void> = {};

  const fakeDocument = {
    querySelectorAll: (selector: string) => {
      if (selector === ".cm-content") return cmEditors;
      if (selector === '[data-e2e-locator="console-testcase-tag"]') return caseTags;
      if (selector === '[data-e2e-locator="console-testcase-input"]') return paramFields;
      if (selector.includes("textarea")) return textareas;
      return [];
    },
    querySelector: () => null,
    addEventListener: (type: string, fn: () => void) => {
      listeners[type] = fn;
    },
    getElementById: () => null,
  };
  const fakeWindow = {
    fetch: () => Promise.resolve(new Response()),
    postMessage: (message: { payload: { cases: string[]; code: string; captureError?: string; source: string } }) => {
      snapshots.push(message);
    },
    setInterval: () => 0,
    setTimeout: (fn: () => void) => {
      fn();
      return 1;
    },
    clearTimeout: () => undefined,
  };
  class FakeXhr {
    open(): void {}
    send(): void {}
  }

  vi.stubGlobal("document", fakeDocument);
  vi.stubGlobal("window", fakeWindow);
  vi.stubGlobal("location", {
    pathname: "/problems/example/",
    origin: "https://leetcode.com",
  });
  vi.stubGlobal("localStorage", { getItem: () => JSON.stringify("cpp") });
  vi.stubGlobal("XMLHttpRequest", FakeXhr);

  return {
    snapshots,
    cmEditors,
    fireInput: () => listeners.input?.(),
  };
}

test("publishes every case from a one-parameter aggregate buffer", async () => {
  const { snapshots } = installPage({
    code: TREE_CODE,
    buffer: "[4,2,7,1,3,6,9]\n[2,1,3]\n[]",
    caseTags: 3,
    paramFields: 1,
  });

  await import("./inject.js");

  expect(snapshots.at(-1)?.payload.cases).toEqual([
    "[4,2,7,1,3,6,9]",
    "[2,1,3]",
    "[]",
  ]);
});

test("publishes every case from a multi-parameter aggregate buffer", async () => {
  const { snapshots } = installPage({
    code: "class Solution { public: vector<int> twoSum(vector<int>& nums, int target) { return {}; } };",
    buffer: "[2,7,11,15]\n9\n[3,2,4]\n6\n[3,3]\n6",
    caseTags: 3,
    paramFields: 2,
  });

  await import("./inject.js");

  expect(snapshots.at(-1)?.payload.cases).toEqual([
    "[2,7,11,15]\n9",
    "[3,2,4]\n6",
    "[3,3]\n6",
  ]);
});

test("still publishes cases when case and param counts disagree with the buffer", async () => {
  const { snapshots } = installPage({
    code: "class Solution { public: int solve(vector<int>& nums) { return 0; } };",
    buffer: "[1]\n[2]\n[3]",
    caseTags: 2,
    paramFields: 2,
  });

  await import("./inject.js");

  expect(snapshots.at(-1)?.payload.cases.length).toBeGreaterThan(0);
  expect(snapshots.at(-1)?.payload.captureError).toBeUndefined();
});

test("treats the buffer as a single case when LeetCode exposes no case tabs", async () => {
  const { snapshots } = installPage({
    code: "class Solution { public: int solve(vector<int>& nums, int target) { return 0; } };",
    buffer: "[1,2,3]\n2",
    caseTags: 0,
    paramFields: 0,
  });

  await import("./inject.js");

  expect(snapshots.at(-1)?.payload.cases).toEqual(["[1,2,3]\n2"]);
});

test("uses the only CodeMirror buffer as testcases when the solution editor is not CM", async () => {
  const { snapshots } = installPage({
    buffer: "[4,2,7,1,3,6,9]\n[2,1,3]\n[]",
    caseTags: 3,
    paramFields: 1,
  });

  await import("./inject.js");

  expect(snapshots.at(-1)?.payload.cases).toEqual([
    "[4,2,7,1,3,6,9]",
    "[2,1,3]",
    "[]",
  ]);
});

test("reads one CodeMirror editor per case tab when LeetCode splits editors", async () => {
  const caseA = "[\n  1,\n  2,\n  3,\n  4,\n  5,\n  6,\n  7\n]";
  const caseB = "[\n  8,\n  9,\n  10,\n  11,\n  12,\n  13,\n  14,\n  15\n]";
  const { snapshots } = installPage({
    code: TREE_CODE,
    buffers: [caseA, caseB],
    caseTags: 2,
    paramFields: 1,
  });

  await import("./inject.js");

  expect(snapshots.at(-1)?.payload.cases).toEqual([caseA, caseB]);
  expect(snapshots.at(-1)?.payload.captureError).toBeUndefined();
});

test("after Run, a later editor poll that only sees output keeps the graph cases", async () => {
  const { snapshots, cmEditors, fireInput } = installPage({
    code: TREE_CODE,
    buffer: "[4,2,7,1,3,6,9]\n[2,1,3]\n[]",
    caseTags: 3,
    paramFields: 1,
  });

  await import("./inject.js");

  await (window.fetch as typeof fetch)("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body: JSON.stringify({
      data_input: "[4,2,7,1,3,6,9]",
      typed_code: TREE_CODE,
      lang: "cpp",
    }),
  });
  expect(snapshots.at(-1)?.payload.source).toBe("network");
  expect(snapshots.at(-1)?.payload.cases).toHaveLength(3);

  cmEditors.length = 0;
  cmEditors.push(editor(TREE_CODE), editor("[4,2,7,1,3,6,9]", "console-result"));
  fireInput();

  expect(snapshots.at(-1)?.payload.cases).toEqual([
    "[4,2,7,1,3,6,9]",
    "[2,1,3]",
    "[]",
  ]);
  expect(snapshots.at(-1)?.payload.captureError).toBeUndefined();
});

test("keeps a multi-case collection when a Run only carries one case", async () => {
  const { snapshots } = installPage({
    code: TREE_CODE,
    buffer: "[4,2,7,1,3,6,9]\n[2,1,3]\n[]",
    caseTags: 3,
    paramFields: 1,
  });

  await import("./inject.js");
  expect(snapshots.at(-1)?.payload.cases).toHaveLength(3);

  const body = JSON.stringify({
    data_input: "[2,1,3]",
    typed_code: TREE_CODE,
    lang: "cpp",
  });
  await (window.fetch as typeof fetch)("https://leetcode.com/problems/example/interpret_solution/", {
    method: "POST",
    body,
  });

  expect(snapshots.at(-1)?.payload.source).toBe("network");
  expect(snapshots.at(-1)?.payload.cases).toEqual([
    "[4,2,7,1,3,6,9]",
    "[2,1,3]",
    "[]",
  ]);
});

test("ignores a result editor that appears before the testcase buffer after Run", async () => {
  const { snapshots } = installPage({
    code: TREE_CODE,
    resultBefore: ["[9,9,9]"],
    buffer: "[4,2,7,1,3,6,9]\n[2,1,3]\n[]",
    caseTags: 3,
    paramFields: 1,
  });

  await import("./inject.js");

  expect(snapshots.at(-1)?.payload.cases).toEqual([
    "[4,2,7,1,3,6,9]",
    "[2,1,3]",
    "[]",
  ]);
  expect(snapshots.at(-1)?.payload.captureError).toBeUndefined();
});

test("prefers the aggregate buffer over a duplicated selected-case editor", async () => {
  const aggregate = "[4,2,7,1,3,6,9]\n[2,1,3]\n[]";
  const { snapshots } = installPage({
    code: TREE_CODE,
    buffers: [
      { text: "[4,2,7,1,3,6,9]", locator: "console-testcase-input" },
      aggregate,
    ],
    caseTags: 3,
    paramFields: 1,
  });

  await import("./inject.js");

  expect(snapshots.at(-1)?.payload.cases).toEqual([
    "[4,2,7,1,3,6,9]",
    "[2,1,3]",
    "[]",
  ]);
});

test("keeps the last good cases when a later poll only sees the result editor", async () => {
  const { snapshots, cmEditors, fireInput } = installPage({
    code: TREE_CODE,
    buffer: "[4,2,7,1,3,6,9]\n[2,1,3]\n[]",
    caseTags: 3,
    paramFields: 1,
  });

  await import("./inject.js");
  expect(snapshots.at(-1)?.payload.cases).toHaveLength(3);

  cmEditors.length = 0;
  cmEditors.push(editor(TREE_CODE), editor("true", "console-result"));
  fireInput();

  expect(snapshots.at(-1)?.payload.cases).toEqual([
    "[4,2,7,1,3,6,9]",
    "[2,1,3]",
    "[]",
  ]);
  expect(snapshots.at(-1)?.payload.captureError).toBeUndefined();
});

test("publishes the visible selected case when only per-param editors exist", async () => {
  const { snapshots } = installPage({
    code: "class Solution { public: vector<int> twoSum(vector<int>& nums, int target) { return {}; } };",
    buffers: [
      { text: "[2,7,11,15]", locator: "console-testcase-input" },
      { text: "9", locator: "console-testcase-input" },
    ],
    caseTags: 3,
    paramFields: 2,
  });

  await import("./inject.js");

  expect(snapshots.at(-1)?.payload.cases).toEqual(["[2,7,11,15]\n9"]);
  expect(snapshots.at(-1)?.payload.captureError).toBeUndefined();
});
