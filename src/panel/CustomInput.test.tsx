import { Window } from "happy-dom";
import { createRef, render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CustomInput } from "./CustomInput.js";
import type { CustomField } from "./customCase.js";

let dom: Window;
let container: HTMLDivElement;

beforeEach(() => {
  dom = new Window();
  vi.stubGlobal("window", dom);
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("navigator", dom.navigator);
  vi.stubGlobal("HTMLElement", dom.HTMLElement);
  vi.stubGlobal("Node", dom.Node);
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(() => {
  render(null, container);
  vi.unstubAllGlobals();
});

function field(overrides: Partial<CustomField> = {}): CustomField {
  return {
    name: "root",
    type: "TreeNode",
    placeholder: "[1,2,3,null,4]",
    value: "",
    kind: "auto",
    scalar: false,
    removable: false,
    ...overrides,
  };
}

async function mount(fields: CustomField[], canAddField = false) {
  const handlers = {
    onValueChange: vi.fn(),
    onKindChange: vi.fn(),
    onPasteValues: vi.fn(),
    onAddField: vi.fn(),
    onRemoveField: vi.fn(),
    onApply: vi.fn(),
  };
  const inputRef = createRef<HTMLTextAreaElement>();
  await act(async () => {
    render(<CustomInput fields={fields} canAddField={canAddField} inputRef={inputRef} {...handlers} />, container);
  });
  const textareas = [...container.querySelectorAll<HTMLTextAreaElement>("textarea")];
  const selects = [...container.querySelectorAll<HTMLSelectElement>("select")];
  return { ...handlers, inputRef, textareas, selects };
}

async function keydown(target: HTMLTextAreaElement, init: { key: string; shiftKey?: boolean }) {
  const event = new window.KeyboardEvent("keydown", { ...init, bubbles: true, cancelable: true });
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}

async function paste(target: HTMLTextAreaElement, text: string) {
  const event = new window.Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: { getData: () => text } });
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}

const LCA_FIELDS = [
  field({ value: "[3,5,1]", detected: "binary-tree" }),
  field({ name: "p", placeholder: "[1,2,3,null,4]", value: "5" }),
  field({ name: "q", kind: "none" }),
  field({ name: "grid", type: "character[][]", kind: "matrix" }),
];

describe("CustomInput", () => {
  it("renders one labelled row per field with type hints and placeholders", async () => {
    const { textareas, inputRef } = await mount(LCA_FIELDS);

    expect(textareas).toHaveLength(4);
    expect(textareas.map((area) => area.getAttribute("rows"))).toEqual(["1", "1", "1", "1"]);
    expect(textareas[0]?.getAttribute("placeholder")).toBe("[1,2,3,null,4]");
    expect(inputRef.current).toBe(textareas[0]);

    const labels = [...container.querySelectorAll<HTMLLabelElement>("label.custom-param-name")];
    expect(labels.map((label) => label.textContent)).toEqual(["rootTreeNode", "pTreeNode", "qTreeNode", "gridcharacter[][]"]);
    expect(labels.map((label) => label.getAttribute("for"))).toEqual(textareas.map((area) => area.id));
    expect(new Set(textareas.map((area) => area.id)).size).toBe(4);
  });

  it("reflects detection in the auto option and shows explicit choices", async () => {
    const { selects } = await mount(LCA_FIELDS);

    expect([...selects[0]!.options].map((option) => option.textContent)).toEqual([
      "Auto (Binary tree)",
      "None",
      "Binary tree",
      "Linked list",
      "Graph",
    ]);
    expect([...selects[1]!.options][0]?.textContent).toBe("Auto");
    expect(selects[2]?.value).toBe("none");
    expect(selects[0]?.getAttribute("aria-label")).toBe("Structure for root: Auto (Binary tree)");
    expect([...container.querySelectorAll(".custom-kind-value")].map((node) => node.textContent)).toEqual([
      "Auto (Binary tree)",
      "Auto",
      "None",
      "Graph",
    ]);
  });

  it("reports kind changes per field", async () => {
    const { selects, onKindChange } = await mount(LCA_FIELDS);

    await act(async () => {
      selects[1]!.value = "linked-list";
      selects[1]!.dispatchEvent(new window.Event("change", { bubbles: true }));
    });

    expect(onKindChange).toHaveBeenCalledWith(1, "linked-list");
  });

  it("applies on Enter in any field and keeps Shift+Enter as a newline", async () => {
    const { textareas, onApply } = await mount(LCA_FIELDS);

    const plain = await keydown(textareas[2]!, { key: "Enter" });
    expect(onApply).toHaveBeenCalledOnce();
    expect(plain.defaultPrevented).toBe(true);

    const shifted = await keydown(textareas[1]!, { key: "Enter", shiftKey: true });
    expect(onApply).toHaveBeenCalledOnce();
    expect(shifted.defaultPrevented).toBe(false);
  });

  it("reports typed text per field and applies from the single Draw button", async () => {
    const { textareas, onValueChange, onApply } = await mount(LCA_FIELDS);

    await act(async () => {
      textareas[1]!.value = "7";
      textareas[1]!.dispatchEvent(new window.Event("input", { bubbles: true }));
    });
    expect(onValueChange).toHaveBeenLastCalledWith(1, "7");

    const buttons = container.querySelectorAll<HTMLButtonElement>("button[type=submit]");
    expect(buttons).toHaveLength(1);
    await act(async () => {
      buttons[0]?.click();
    });
    expect(onApply).toHaveBeenCalledOnce();
  });

  it("spreads a multi-value paste across fields", async () => {
    const { textareas, onPasteValues } = await mount(LCA_FIELDS);

    const event = await paste(textareas[0]!, "[3,5,1]\n5\n1");

    expect(event.defaultPrevented).toBe(true);
    expect(onPasteValues).toHaveBeenCalledWith(0, ["[3,5,1]", "5", "1"]);
  });

  it("hides the structure picker for scalar params", async () => {
    const { selects } = await mount([field(), field({ name: "k", type: "integer", scalar: true })]);

    expect(selects).toHaveLength(1);
    expect(container.querySelectorAll(".custom-param")).toHaveLength(2);
  });

  it("leaves a single-value paste to the browser", async () => {
    const { textareas, onPasteValues } = await mount(LCA_FIELDS);

    const event = await paste(textareas[0]!, "[1,2,3]");

    expect(event.defaultPrevented).toBe(false);
    expect(onPasteValues).not.toHaveBeenCalled();
  });

  it("hides add and remove controls for fixed signature fields", async () => {
    await mount(LCA_FIELDS);

    expect(container.querySelector(".custom-add")).toBeNull();
    expect(container.querySelector(".custom-param-remove")).toBeNull();
  });

  it("adds and removes free-form fields", async () => {
    const fields = [
      field({ name: "arg 1", type: "", removable: true }),
      field({ name: "arg 2", type: "", removable: true }),
    ];
    const { onAddField, onRemoveField } = await mount(fields, true);

    expect(container.querySelector(".custom-param-type")).toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>(".custom-add")?.click();
    });
    expect(onAddField).toHaveBeenCalledOnce();

    const remove = container.querySelectorAll<HTMLButtonElement>(".custom-param-remove");
    expect(remove[1]?.getAttribute("aria-label")).toBe("Remove arg 2");
    await act(async () => {
      remove[1]?.click();
    });
    expect(onRemoveField).toHaveBeenCalledWith(1);
  });
});

describe("CustomInput focus", () => {
  function renderFields(fields: CustomField[], canAddField: boolean, handlers: Record<string, () => void>) {
    render(
      <CustomInput
        fields={fields}
        canAddField={canAddField}
        onValueChange={vi.fn()}
        onKindChange={vi.fn()}
        onPasteValues={vi.fn()}
        onAddField={handlers.add ?? vi.fn()}
        onRemoveField={handlers.remove ?? vi.fn()}
        onApply={vi.fn()}
      />,
      container,
    );
  }

  it("focuses the new field once it renders after Add input", async () => {
    const one = [field({ name: "arg 1", type: "" })];
    const two = [...one, field({ name: "arg 2", type: "" })];
    let added = false;
    await act(async () => {
      renderFields(one, true, { add: () => { added = true; } });
    });

    await act(async () => {
      container.querySelector<HTMLButtonElement>(".custom-add")?.click();
    });
    expect(added).toBe(true);
    expect(document.activeElement).not.toBe(container.querySelectorAll("textarea")[0]);

    await act(async () => {
      renderFields(two, true, {});
    });
    expect(document.activeElement).toBe(container.querySelectorAll("textarea")[1]);
  });

  it("focuses the last filled field after a capped multi-value paste", async () => {
    await act(async () => {
      renderFields(LCA_FIELDS, false, {});
    });

    await paste(container.querySelectorAll("textarea")[1]!, "1\n2\n3\n4\n5");

    expect(document.activeElement).toBe(container.querySelectorAll("textarea")[3]);
  });
});
