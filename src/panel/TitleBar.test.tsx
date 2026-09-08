/** @vitest-environment happy-dom */

import { render } from "preact";
import { afterEach, describe, expect, it } from "vitest";

import { TitleBar } from "./TitleBar.js";

const noop = (): void => {};

function mount(selectedKind: Parameters<typeof TitleBar>[0]["selectedKind"]): HTMLDivElement {
  const root = document.createElement("div");
  document.body.appendChild(root);
  render(
    <TitleBar
      showSettings={false}
      selectedKind={selectedKind}
      onKindChange={noop}
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
    const choices = [...root.querySelectorAll("select.kind-select option")].map(
      (option) => option.textContent,
    );
    expect(choices).toEqual(["Binary tree", "Linked list", "Graph"]);
  });

  it("shows the chosen structure after a pick", () => {
    const root = mount("linked-list");
    expect(root.querySelector(".kind-value")?.textContent).toBe("Linked list");
  });
});
