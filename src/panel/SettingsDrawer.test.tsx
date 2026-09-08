/** @vitest-environment happy-dom */

import { render } from "preact";
import { afterEach, describe, expect, it } from "vitest";

import { DEFAULT_SETTINGS } from "../settings/schema.js";
import { SettingsDrawer } from "./SettingsDrawer.js";

function mount(): HTMLDivElement {
  const root = document.createElement("div");
  document.body.appendChild(root);
  render(
    <SettingsDrawer
      settings={DEFAULT_SETTINGS}
      activePalette="dark"
      onChange={() => {}}
      onClose={() => {}}
    />,
    root,
  );
  return root;
}

afterEach(() => {
  document.body.innerHTML = "";
});

function labels(root: ParentNode, group: string): string[] {
  return [...root.querySelectorAll(`[aria-label="${group}"] .shape-label`)].map(
    (el) => el.textContent ?? "",
  );
}

describe("SettingsDrawer", () => {
  it("does not offer node size, box, thickness, or a title", () => {
    const root = mount();
    expect(root.textContent).not.toMatch(/Node size/);
    expect(root.textContent).not.toMatch(/Box/);
    expect(root.textContent).not.toMatch(/Thickness/);
    expect(root.querySelector(".style-rail-title")).toBeNull();
    expect(root.querySelector('[aria-label="Edge thickness"]')).toBeNull();
  });

  it("uses all-caps section headings", () => {
    const root = mount();
    expect([...root.querySelectorAll(".style-section-title")].map((el) => el.textContent)).toEqual([
      "APPEARANCE",
      "NODE SHAPE",
      "EDGES",
      "BACKGROUND",
      "NODE BACKGROUND",
    ]);
  });

  it("offers the extra node shapes", () => {
    const root = mount();
    expect(labels(root, "Node shape")).toEqual([
      "Circle",
      "Ellipse",
      "Square",
      "Diamond",
      "Hexagon",
      "Double",
    ]);
  });

  it("offers edge style, color, and arrows", () => {
    const root = mount();
    expect(labels(root, "Edge style")).toEqual(["Solid", "Dashed", "Dotted", "Bold"]);
    expect(root.querySelector('[aria-label="Edge color"]')).not.toBeNull();
    expect(labels(root, "Arrowheads")).toEqual(["On", "Off"]);
  });
});
