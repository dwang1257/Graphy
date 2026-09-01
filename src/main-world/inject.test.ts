import { afterEach, expect, test, vi } from "vitest";

interface FakeEditor extends HTMLElement {
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

function editor(text: string): FakeEditor {
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
  } as FakeEditor;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

function installPage(options: {
  code?: string;
  buffer: string;
  caseTags?: number;
  paramFields?: number;
  textareas?: string[];
}): { snapshots: Array<{ payload: { cases: string[]; captureError?: string; source: string } }> } {
  const snapshots: Array<{ payload: { cases: string[]; captureError?: string; source: string } }> = [];
  const cmEditors = [
    ...(options.code !== undefined ? [editor(options.code)] : []),
    editor(options.buffer),
  ];
  const caseTags = Array.from({ length: options.caseTags ?? 0 }, (_, i) => ({
    textContent: `Case ${i + 1}`,
  }));
  const paramFields = Array.from({ length: options.paramFields ?? 0 }, () => ({}));
  const textareas = (options.textareas ?? []).map((value) => ({ value }));

  const fakeDocument = {
    querySelectorAll: (selector: string) => {
      if (selector === ".cm-content") return cmEditors;
      if (selector === '[data-e2e-locator="console-testcase-tag"]') return caseTags;
      if (selector === '[data-e2e-locator="console-testcase-input"]') return paramFields;
      if (selector.includes("textarea")) return textareas;
      return [];
    },
    querySelector: () => null,
    addEventListener: () => undefined,
    getElementById: () => null,
  };
  const fakeWindow = {
    fetch: () => Promise.resolve(new Response()),
    postMessage: (message: { payload: { cases: string[]; captureError?: string; source: string } }) => {
      snapshots.push(message);
    },
    setInterval: () => 0,
    setTimeout: () => 0,
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

  return { snapshots };
}

test("publishes every case from a one-parameter aggregate buffer", async () => {
  const { snapshots } = installPage({
    code: "class Solution { public: TreeNode* invertTree(TreeNode* root) { return root; } };",
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

test("reports a capture error when case and param counts disagree with the buffer", async () => {
  const { snapshots } = installPage({
    code: "class Solution { public: int solve(vector<int>& nums) { return 0; } };",
    buffer: "[1]\n[2]\n[3]",
    caseTags: 2,
    paramFields: 2,
  });

  await import("./inject.js");

  expect(snapshots.at(-1)?.payload.cases).toEqual([]);
  expect(snapshots.at(-1)?.payload.captureError).toMatch(/Could not separate test cases/);
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

test("keeps a multi-case collection when a Run only carries one case", async () => {
  const { snapshots } = installPage({
    code: "class Solution { public: TreeNode* invertTree(TreeNode* root) { return root; } };",
    buffer: "[4,2,7,1,3,6,9]\n[2,1,3]\n[]",
    caseTags: 3,
    paramFields: 1,
  });

  await import("./inject.js");
  expect(snapshots.at(-1)?.payload.cases).toHaveLength(3);

  const body = JSON.stringify({
    data_input: "[2,1,3]",
    typed_code: "class Solution { public: TreeNode* invertTree(TreeNode* root) { return root; } };",
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
