import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CUSTOM_CASE, CaseTabs, type CaseSelection } from "./CaseTabs.js";

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

async function mount(selection: CaseSelection | null = 0, count = 3) {
  const onChange = vi.fn();
  await act(async () => {
    render(<CaseTabs count={count} selection={selection} onChange={onChange} />, container);
  });
  return { onChange, tabs: [...container.querySelectorAll<HTMLButtonElement>("[role=tab]")] };
}

async function press(tab: HTMLButtonElement | undefined, key: string) {
  await act(async () => {
    tab?.dispatchEvent(new dom.KeyboardEvent("keydown", { key, bubbles: true }) as unknown as Event);
  });
}

describe("CaseTabs", () => {
  it("exposes selected state, labels, controls, and roving tab focus", async () => {
    const { tabs } = await mount(1);

    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual(["Case 1", "Case 2", "Case 3", "Custom"]);
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["false", "true", "false", "false"]);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1, -1]);
    expect(tabs.map((tab) => tab.id)).toEqual([
      "graphy-case-tab-0",
      "graphy-case-tab-1",
      "graphy-case-tab-2",
      "graphy-case-tab-custom",
    ]);
    expect(tabs.every((tab) => tab.getAttribute("aria-controls") === "graphy-case-panel")).toBe(true);
  });

  it("shows only Custom without cases and Case 1 plus Custom with one case", async () => {
    const empty = await mount(null, 0);
    expect(empty.tabs.map((tab) => tab.textContent)).toEqual(["Custom"]);
    expect(empty.tabs[0]?.getAttribute("aria-selected")).toBe("false");
    expect(empty.tabs[0]?.tabIndex).toBe(0);

    const single = await mount(CUSTOM_CASE, 1);
    expect(single.tabs.map((tab) => tab.textContent)).toEqual(["Case 1", "Custom"]);
    expect(single.tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["false", "true"]);
    expect(single.tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0]);
  });

  it("reports clicks with the selected tab", async () => {
    const { onChange, tabs } = await mount(0);

    await act(async () => {
      tabs[3]?.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(CUSTOM_CASE, "click");

    await act(async () => {
      tabs[2]?.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(2, "click");
  });

  it("moves selection and focus with arrow keys", async () => {
    const { onChange, tabs } = await mount(1);
    tabs[1]?.focus();

    await press(tabs[1], "ArrowRight");

    expect(onChange).toHaveBeenCalledWith(2, "arrow");
    expect(document.activeElement).toBe(tabs[2]);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, -1, 0, -1]);
  });

  it("wraps arrow keys across the Case tabs and Custom", async () => {
    const { onChange, tabs } = await mount(2);
    tabs[2]?.focus();

    await press(tabs[2], "ArrowRight");
    expect(onChange).toHaveBeenLastCalledWith(CUSTOM_CASE, "arrow");
    expect(document.activeElement).toBe(tabs[3]);

    await press(tabs[3], "ArrowRight");
    expect(onChange).toHaveBeenLastCalledWith(0, "arrow");
    expect(document.activeElement).toBe(tabs[0]);

    await press(tabs[0], "ArrowLeft");
    expect(onChange).toHaveBeenLastCalledWith(CUSTOM_CASE, "arrow");
    expect(document.activeElement).toBe(tabs[3]);
  });

  it("supports Home and End without trapping unrelated keyboard input", async () => {
    const { onChange, tabs } = await mount(1);
    tabs[1]?.focus();

    await press(tabs[1], "Home");
    expect(onChange).toHaveBeenLastCalledWith(0, "arrow");
    expect(document.activeElement).toBe(tabs[0]);

    await press(tabs[0], "End");
    expect(onChange).toHaveBeenLastCalledWith(CUSTOM_CASE, "arrow");
    expect(document.activeElement).toBe(tabs[3]);

    const event = new dom.KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    tabs[3]?.dispatchEvent(event as unknown as Event);
    expect(event.defaultPrevented).toBe(false);
  });
});
