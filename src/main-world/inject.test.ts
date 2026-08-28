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

interface Visibility {
  active: boolean;
}

function editor(text: string, visibility: Visibility): FakeEditor {
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
    closest: (selector: string) =>
      selector.includes("inactive") && !visibility.active ? ({} as Element) : null,
    getClientRects: () =>
      visibility.active ? ({ length: 1 } as DOMRectList) : ({ length: 0 } as DOMRectList),
  } as FakeEditor;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

test("publishes only the active case and follows a case switch", async () => {
  const alwaysVisible = { active: true };
  const caseOne = { active: true };
  const caseTwo = { active: false };
  const code = editor(
    "class Solution { public: int solve(vector<int>& nums, int target) { return 0; } };",
    alwaysVisible,
  );
  const caseOneArgs = [
    editor("[1,2,3]", caseOne),
    editor("2", caseOne),
  ];
  const caseTwoArgs = [
    editor("[9,8,7]", caseTwo),
    editor("8", caseTwo),
  ];
  const mirroredTextareas = [
    Object.assign(editor("[1,2,3]", caseOne), { value: "[1,2,3]" }),
    Object.assign(editor("[9,8,7]", caseTwo), { value: "[9,8,7]" }),
  ];
  const snapshots: Array<{ payload: { input: string } }> = [];
  let intervalCallback: (() => void) | undefined;

  const fakeDocument = {
    querySelectorAll: (selector: string) => {
      if (selector === ".cm-content") return [code, ...caseOneArgs, ...caseTwoArgs];
      if (selector.includes("textarea")) return mirroredTextareas;
      return [];
    },
    querySelector: () => null,
    addEventListener: () => undefined,
    getElementById: () => null,
  };
  const fakeWindow = {
    fetch: () => Promise.resolve(new Response()),
    postMessage: (message: { payload: { input: string } }) => snapshots.push(message),
    setInterval: (callback: () => void) => {
      intervalCallback = callback;
      return 0;
    },
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

  await import("./inject.js");

  expect(snapshots.at(-1)?.payload.input).toBe("[1,2,3]\n2");

  caseOne.active = false;
  caseTwo.active = true;
  expect(intervalCallback).toBeTypeOf("function");
  intervalCallback?.();

  expect(snapshots.at(-1)?.payload.input).toBe("[9,8,7]\n8");
});
