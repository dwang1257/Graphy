/** @vitest-environment happy-dom */

import { render } from "preact";
import { afterEach, describe, expect, it } from "vitest";

import type { StructureKind } from "../core/types.js";
import { TitleBar } from "./TitleBar.js";

const noop = (): void => {};

function mount(
  selectedKind: Parameters<typeof TitleBar>[0]["selectedKind"],
  onKindChange: (kind: StructureKind) => void = noop,
): HTMLDivElement {
  const root = document.createElement("div");
  document.body.appendChild(root);
  render(
    <TitleBar
      showSettings={false}
      selectedKind={selectedKind}
      onKindChange={onKindChange}
      onFit={noop}
      onToggleSettings={noop}
      onClose={noop}
      shrunk={false}
      onToggleShrunk={noop}
      onDrag={noop}
      onDragEnd={noop}
    />,
    root,
  );
  return root;
}

function kindSelect(root: ParentNode): HTMLSelectElement {
  const select = root.querySelector("select.kind-select");
  if (!(select instanceof HTMLSelectElement)) throw new Error("missing structure select");
  return select;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("TitleBar structure dropdown", () => {
  it("shows choose an option before a structure is picked", () => {
    const root = mount(undefined);
    expect(root.querySelector(".kind-value")?.textContent).toBe("Choose an Option:");
  });

  it("keeps only binary tree, linked list, and graph as choices", () => {
    const root = mount(undefined);
    const choices = [...root.querySelectorAll("select.kind-select option")]
      .filter((option) => option instanceof HTMLOptionElement && option.value !== "")
      .map((option) => option.textContent);
    expect(choices).toEqual(["Binary tree", "Linked list", "Graph"]);
  });

  it("shows the chosen structure after a pick", () => {
    const root = mount("linked-list");
    expect(root.querySelector(".kind-value")?.textContent).toBe("Linked list");
  });

  it("keeps the native select on a blank value until a structure is picked", () => {
    const root = mount(undefined);
    const select = kindSelect(root);
    expect([...select.options].some((option) => option.value === "")).toBe(true);
    expect(select.value).toBe("");
  });

  it("reports the first structure when it is chosen from the placeholder", () => {
    let chosen: StructureKind | undefined;
    const root = mount(undefined, (kind) => {
      chosen = kind;
    });
    const select = kindSelect(root);
    select.value = "binary-tree";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(chosen).toBe("binary-tree");
  });

  it("updates the visible label after a structure is chosen", () => {
    let selectedKind: StructureKind | undefined;
    const root = document.createElement("div");
    document.body.appendChild(root);
    const draw = (): void => {
      render(
        <TitleBar
          showSettings={false}
          selectedKind={selectedKind}
          onKindChange={(kind) => {
            selectedKind = kind;
            draw();
          }}
          onFit={noop}
          onToggleSettings={noop}
          onClose={noop}
          shrunk={false}
          onToggleShrunk={noop}
          onDrag={noop}
          onDragEnd={noop}
        />,
        root,
      );
    };
    draw();
    const select = kindSelect(root);
    select.value = "linked-list";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    expect(root.querySelector(".kind-value")?.textContent).toBe("Linked list");
  });
});
