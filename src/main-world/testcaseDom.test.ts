import { expect, it } from "vitest";

import { createTestcaseDomAdapter } from "./testcaseDom.js";

interface FakeElementOptions {
  attributes?: Record<string, string>;
  editorText?: string;
  isTextarea?: boolean;
  textareaValue?: string;
  descendantTextareaValue?: string;
  textContent?: string;
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
    textContent: options.textContent,
    ...(options.isTextarea ? { value: options.textareaValue ?? "" } : {}),
  } as unknown as HTMLElement;
}

interface FakeNodeOptions {
  tag?: string;
  attributes?: Record<string, string>;
  className?: string;
  text?: string;
  children?: FakeNode[];
  onClick?: () => void;
}

class FakeNode {
  tagName: string;
  attributes: Record<string, string>;
  className: string;
  childNodes: FakeNode[];
  parentElement: FakeNode | null = null;
  text: string;
  onClick?: () => void;

  constructor(options: FakeNodeOptions = {}) {
    this.tagName = (options.tag ?? "div").toUpperCase();
    this.attributes = options.attributes ?? {};
    this.className = options.className ?? "";
    this.text = options.text ?? "";
    this.childNodes = options.children ?? [];
    this.onClick = options.onClick;
    for (const child of this.childNodes) child.parentElement = this;
  }

  get children(): FakeNode[] {
    return this.childNodes;
  }

  get textContent(): string {
    return `${this.childNodes.map((child) => child.textContent).join("")}${this.text}`;
  }

  get nextElementSibling(): FakeNode | null {
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
    return matchesSelector(this, selector);
  }

  contains(other: FakeNode): boolean {
    let node: FakeNode | null = other;
    while (node) {
      if (node === this) return true;
      node = node.parentElement;
    }
    return false;
  }

  querySelector(selector: string): FakeNode | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }

  querySelectorAll(selector: string): FakeNode[] {
    const found: FakeNode[] = [];
    const visit = (node: FakeNode): void => {
      if (matchesSelector(node, selector)) found.push(node);
      for (const child of node.childNodes) visit(child);
    };
    for (const child of this.childNodes) visit(child);
    return found;
  }

  asElement(): HTMLElement {
    return this as unknown as HTMLElement;
  }
}

function matchesSelector(node: FakeNode, selector: string): boolean {
  return selector.split(",").some((part) => matchesSimpleSelector(node, part.trim()));
}

function matchesSimpleSelector(node: FakeNode, selector: string): boolean {
  const attr = selector.match(/^\[([^=]+)="([^"]+)"\]$/);
  if (attr) return node.getAttribute(attr[1]!) === attr[2];
  if (selector.startsWith(".")) return node.className.split(/\s+/).includes(selector.slice(1));
  return node.tagName === selector.toUpperCase();
}

function resultDocument(options: {
  cases: string[][];
  selected: number;
  officialTabs?: HTMLElement[];
}): Document & { selected: number } {
  const state = { selected: options.selected };
  const pills = options.cases.map((parameters, index) => {
    const label = new FakeNode({ tag: "div", text: `Case ${index + 1}` });
    return new FakeNode({
      className: `cursor-pointer rounded-lg px-4 py-1 font-medium${
        index === state.selected ? " bg-fill-3" : ""
      }`,
      onClick: () => {
        state.selected = index;
      },
      children: [label],
    });
  });

  const inputValues = (): FakeNode[] =>
    (options.cases[state.selected] ?? []).map(
      (value) =>
        new FakeNode({
          children: [new FakeNode({ className: "font-menlo whitespace-pre-wrap", text: value })],
        }),
    );

  const heading = new FakeNode({ className: "mb-2 text-xs font-medium", text: "Input" });
  const section = new FakeNode({ className: "space-y-2", children: inputValues() });
  const inputBlock = new FakeNode({ children: [heading, section] });
  const result = new FakeNode({
    attributes: { "data-e2e-locator": "console-result" },
    text: "Accepted",
  });
  const panel = new FakeNode({
    className: "mx-5 my-4 space-y-4",
    children: [result, new FakeNode({ className: "flex flex-wrap", children: pills }), inputBlock],
  });

  const refreshInputs = (): void => {
    section.childNodes.splice(0, section.childNodes.length, ...inputValues());
    for (const child of section.childNodes) child.parentElement = section;
    for (const [index, pill] of pills.entries()) {
      pill.className = `cursor-pointer rounded-lg px-4 py-1 font-medium${
        index === state.selected ? " bg-fill-3" : ""
      }`;
    }
  };

  for (const pill of pills) {
    const original = pill.onClick;
    pill.onClick = () => {
      original?.();
      refreshInputs();
    };
  }

  const root = new FakeNode({ children: [panel] });
  const documentNode = {
    selected: state.selected,
    querySelector: (selector: string) => {
      if (options.officialTabs && selector === '[data-e2e-locator="console-testcase-tag"]') {
        return options.officialTabs[0] ?? null;
      }
      return root.querySelector(selector);
    },
    querySelectorAll: (selector: string) => {
      if (selector === '[data-e2e-locator="console-testcase-tag"]') {
        return options.officialTabs ?? [];
      }
      if (selector === '[data-e2e-locator="console-testcase-input"]') return [];
      return root.querySelectorAll(selector);
    },
    get selectedIndex() {
      return state.selected;
    },
  };
  return documentNode as unknown as Document & { selected: number };
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

it("reads contenteditable testcase input wrappers", () => {
  const adapter = createTestcaseDomAdapter(
    fakeDocument({
      wrappers: [
        fakeElement({ attributes: { contenteditable: "true" }, textContent: "[2,7,11,15]" }),
        fakeElement({ attributes: { contenteditable: "true" }, textContent: "9" }),
      ],
    }),
    fakeWindow(),
  );

  expect(adapter.readMountedParameters()).toEqual(["[2,7,11,15]", "9"]);
});

it("discovers Test Result case pills when official testcase tags are absent", () => {
  const doc = resultDocument({
    cases: [["[2,7,11,15]", "9"], ["[3,2,4]", "6"], ["[3,3]", "6"]],
    selected: 0,
  });
  const adapter = createTestcaseDomAdapter(doc, fakeWindow());

  expect(adapter.tabs()).toHaveLength(3);
  expect(adapter.tabs().map((tab) => tab.element.textContent?.trim())).toEqual([
    "Case 1",
    "Case 2",
    "Case 3",
  ]);
});

it("prefers official testcase tags over Test Result case pills", () => {
  const official = [
    fakeElement({ attributes: { "data-e2e-locator": "console-testcase-tag" } }),
    fakeElement({ attributes: { "data-e2e-locator": "console-testcase-tag" } }),
  ];
  const doc = resultDocument({
    cases: [["[1]"], ["[2]"]],
    selected: 0,
    officialTabs: official,
  });
  const adapter = createTestcaseDomAdapter(doc, fakeWindow());

  expect(adapter.tabs()).toHaveLength(2);
  expect(adapter.tabs()[0]?.element).toBe(official[0]);
});

it("reads the Test Result Input section for the selected case", () => {
  const doc = resultDocument({
    cases: [["[2,7,11,15]", "9"], ["[3,2,4]", "6"]],
    selected: 0,
  });
  const adapter = createTestcaseDomAdapter(doc, fakeWindow());

  expect(adapter.readMountedParameters()).toEqual(["[2,7,11,15]", "9"]);
});

it("selects a Test Result case pill and reads its Input values", () => {
  const doc = resultDocument({
    cases: [["[2,7,11,15]", "9"], ["[3,2,4]", "6"], ["[3,3]", "6"]],
    selected: 0,
  });
  const adapter = createTestcaseDomAdapter(doc, fakeWindow());

  adapter.select(adapter.tabs()[1]!);

  expect(adapter.selectedIndex(adapter.tabs())).toBe(1);
  expect(adapter.readMountedParameters()).toEqual(["[3,2,4]", "6"]);
});

it("waits for Test Result Input values to settle after selecting a pill", async () => {
  const doc = resultDocument({
    cases: [["[2,7,11,15]", "9"], ["[3,2,4]", "6"]],
    selected: 0,
  });
  const adapter = createTestcaseDomAdapter(doc, fakeWindow());
  adapter.select(adapter.tabs()[1]!);

  await expect(adapter.waitUntilSettled(adapter.tabs()[1]!, () => true)).resolves.toEqual([
    "[3,2,4]",
    "6",
  ]);
});
