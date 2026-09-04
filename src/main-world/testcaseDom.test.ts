import { expect, it } from "vitest";

import { createTestcaseDomAdapter } from "./testcaseDom.js";

interface FakeElementOptions {
  attributes?: Record<string, string>;
  editorText?: string;
  isTextarea?: boolean;
  textareaValue?: string;
  descendantTextareaValue?: string;
  onClick?: () => void;
}

function fakeElement(options: FakeElementOptions = {}): HTMLElement {
  const attributes = options.attributes ?? {};
  const editor =
    options.editorText === undefined
      ? null
      : ({
          cmView: {
            rootView: {
              view: {
                state: {
                  doc: { toString: () => options.editorText },
                },
              },
            },
          },
        } as unknown as HTMLElement);
  const textarea =
    options.descendantTextareaValue === undefined
      ? null
      : ({ value: options.descendantTextareaValue } as HTMLTextAreaElement);

  return {
    click: () => options.onClick?.(),
    getAttribute: (name: string) => attributes[name] ?? null,
    matches: (selector: string) => selector === "textarea" && options.isTextarea === true,
    querySelector: (selector: string) => {
      if (selector === ".cm-content") return editor;
      if (selector === "textarea") return textarea;
      return null;
    },
    ...(options.isTextarea ? { value: options.textareaValue ?? "" } : {}),
  } as unknown as HTMLElement;
}

function fakeDocument(options: {
  tabs?: HTMLElement[];
  wrappers?: HTMLElement[];
  unrelatedEditors?: HTMLElement[];
}): Document {
  return {
    querySelectorAll: (selector: string) => {
      if (selector === '[data-e2e-locator="console-testcase-tag"]') {
        return options.tabs ?? [];
      }
      if (selector === '[data-e2e-locator="console-testcase-input"]') {
        return options.wrappers ?? [];
      }
      if (selector === ".cm-content") return options.unrelatedEditors ?? [];
      return [];
    },
  } as unknown as Document;
}

function fakeWindow(onFrame?: () => void): Window {
  return {
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      onFrame?.();
      queueMicrotask(() => callback(0));
      return 1;
    },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  } as unknown as Window;
}

it("reads only editors owned by testcase input wrappers", () => {
  const doc = fakeDocument({
    wrappers: [fakeElement({ editorText: "[1,2,3]" }), fakeElement({ editorText: "2" })],
    unrelatedEditors: [fakeElement({ editorText: "class Solution {}" })],
  });

  const adapter = createTestcaseDomAdapter(doc, fakeWindow());

  expect(adapter.readMountedParameters()).toEqual(["[1,2,3]", "2"]);
});

it("falls back to textarea values inside testcase input wrappers", () => {
  const doc = fakeDocument({
    wrappers: [
      fakeElement({ descendantTextareaValue: "[4,5]" }),
      fakeElement({ descendantTextareaValue: "3" }),
    ],
  });

  const adapter = createTestcaseDomAdapter(doc, fakeWindow());

  expect(adapter.readMountedParameters()).toEqual(["[4,5]", "3"]);
});

it("reads a testcase input wrapper that is itself a textarea", () => {
  const textarea = fakeElement({ isTextarea: true, textareaValue: "[9]" });

  const adapter = createTestcaseDomAdapter(
    fakeDocument({ wrappers: [textarea] }),
    fakeWindow(),
  );

  expect(adapter.readMountedParameters()).toEqual(["[9]"]);
});

it("recognizes the selected testcase tab semantically", () => {
  const tabs = [
    fakeElement({ attributes: { "aria-selected": "false" } }),
    fakeElement({ attributes: { "aria-selected": "true" } }),
  ];
  const adapter = createTestcaseDomAdapter(fakeDocument({ tabs }), fakeWindow());

  expect(adapter.selectedIndex(adapter.tabs())).toBe(1);
});

it("selects a testcase tab through its element", () => {
  let clicks = 0;
  const tab = fakeElement({ onClick: () => clicks++ });
  const adapter = createTestcaseDomAdapter(fakeDocument({ tabs: [tab] }), fakeWindow());

  adapter.select(adapter.tabs()[0]!);

  expect(clicks).toBe(1);
});

it("waits for selection and two equal mounted parameter frames", async () => {
  const attributes = { "aria-selected": "false" };
  const tab = fakeElement({ attributes });
  let value = "[1]";
  const wrapper = fakeElement();
  wrapper.querySelector = (selector: string) =>
    selector === ".cm-content"
      ? ({
          cmView: {
            rootView: {
              view: { state: { doc: { toString: () => value } } },
            },
          },
        } as unknown as HTMLElement)
      : null;
  let frames = 0;
  const win = fakeWindow(() => {
    frames++;
    if (frames === 1) attributes["aria-selected"] = "true";
    if (frames === 2) value = "[2]";
  });
  const adapter = createTestcaseDomAdapter(
    fakeDocument({ tabs: [tab], wrappers: [wrapper] }),
    win,
  );

  await expect(adapter.waitUntilSettled(adapter.tabs()[0]!, () => true)).resolves.toEqual([
    "[2]",
  ]);
  expect(frames).toBe(3);
});

it("rejects settling when the capture is no longer current", async () => {
  const tab = fakeElement({ attributes: { "aria-selected": "true" } });
  const adapter = createTestcaseDomAdapter(
    fakeDocument({ tabs: [tab], wrappers: [fakeElement({ editorText: "[1]" })] }),
    fakeWindow(),
  );

  await expect(adapter.waitUntilSettled(adapter.tabs()[0]!, () => false)).rejects.toThrow(
    "superseded",
  );
});
