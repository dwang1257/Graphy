/** @vitest-environment happy-dom */

import { render } from "preact";
import { afterEach, describe, expect, it } from "vitest";

import { DARK, DEFAULT_SETTINGS, type Settings } from "../settings/schema.js";
import { SettingsDrawer } from "./SettingsDrawer.js";

function mount(
  settings: Settings = DEFAULT_SETTINGS,
  onChange: (next: Settings) => void = () => {},
): HTMLDivElement {
  const root = document.createElement("div");
  document.body.appendChild(root);
  render(
    <SettingsDrawer settings={settings} activePalette="dark" onChange={onChange} onClose={() => {}} />,
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

  it("offers a node background color control", () => {
    const root = mount();
    expect(root.querySelector('[aria-label="Node background color"]')).not.toBeNull();
    expect(root.querySelector('[aria-label="Node background color hex"]')).not.toBeNull();
  });

  it("resets node fill to the theme default", () => {
    const captured: Array<typeof DEFAULT_SETTINGS> = [];
    mount(
      { ...DEFAULT_SETTINGS, dark: { ...DEFAULT_SETTINGS.dark, nodeFill: "#ff00aa" } },
      (next) => captured.push(next),
    );

    const reset = [...document.querySelectorAll("button")].find((btn) => btn.textContent === "Reset style");
    expect(reset).toBeDefined();
    reset?.click();

    expect(captured).toHaveLength(1);
    expect(captured[0]?.dark.nodeFill).toBe(DARK.nodeFill);
  });
});
