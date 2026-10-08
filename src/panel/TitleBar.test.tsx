import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StructureKind } from "../core/types.js";
import { TitleBar } from "./TitleBar.js";

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

async function mount(selectedKind: StructureKind | undefined, detectedKinds: Array<StructureKind | undefined>) {
  const onKindChange = vi.fn();
  const noop = vi.fn();
  await act(async () => {
    render(
      <TitleBar
        showSettings={false}
        selectedKind={selectedKind}
        detectedKinds={detectedKinds}
        onKindChange={onKindChange}
        onFit={noop}
        onToggleSettings={noop}
        onClose={noop}
        shrunk={false}
        onToggleShrunk={noop}
        onDrag={noop}
        onDragEnd={noop}
      />,
      container,
    );
  });
  const select = container.querySelector<HTMLSelectElement>(".kind-select")!;
  const value = container.querySelector(".kind-value")!;
  return { onKindChange, select, value };
}

async function choose(select: HTMLSelectElement, value: string) {
  await act(async () => {
    select.value = value;
    select.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
}

describe("TitleBar kind picker", () => {
  it("shows detected kinds when no override is chosen", async () => {
    const { select, value } = await mount(undefined, ["binary-tree", undefined, "linked-list", "binary-tree"]);

    expect(value.textContent).toBe("Binary tree + Linked list");
    expect(select.value).toBe("");
    expect(select.options[0]?.textContent).toBe("Auto (Binary tree + Linked list)");
    expect(select.getAttribute("aria-label")).toBe("Structure to draw: Binary tree + Linked list");
  });

  it("asks for a choice when nothing is detected", async () => {
    const { select, value } = await mount(undefined, [undefined]);

    expect(value.textContent).toBe("Choose a structure");
    expect(select.options[0]?.textContent).toBe("Auto");
  });

  it("shows the override while keeping detection in the auto option", async () => {
    const { select, value } = await mount("matrix", ["binary-tree"]);

    expect(value.textContent).toBe("Grid");
    expect(select.value).toBe("matrix");
    expect(select.options[0]?.textContent).toBe("Auto (Binary tree)");
  });

  it("reports explicit kinds and a return to auto", async () => {
    const { select, onKindChange } = await mount("matrix", []);

    await choose(select, "linked-list");
    expect(onKindChange).toHaveBeenLastCalledWith("linked-list");

    await choose(select, "");
    expect(onKindChange).toHaveBeenLastCalledWith(undefined);
  });
});
