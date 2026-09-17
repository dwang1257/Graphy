import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CaseTabs } from "./CaseTabs.js";

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

async function mount(activeIndex = 0) {
  const onChange = vi.fn();
  await act(async () => {
    render(<CaseTabs count={3} activeIndex={activeIndex} onChange={onChange} />, container);
  });
  return { onChange, tabs: [...container.querySelectorAll<HTMLButtonElement>("[role=tab]")] };
}

describe("CaseTabs", () => {
  it("exposes selected state, labels, controls, and roving tab focus", async () => {
    const { tabs } = await mount(1);

    expect(tabs.map((tab) => tab.getAttribute("aria-label"))).toEqual(["Case 1", "Case 2", "Case 3"]);
    expect(tabs.map((tab) => tab.getAttribute("aria-selected"))).toEqual(["false", "true", "false"]);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
    expect(tabs.every((tab) => tab.getAttribute("aria-controls") === "graphy-case-panel")).toBe(true);
  });

  it("moves selection and focus with arrow keys", async () => {
    const { onChange, tabs } = await mount(1);
    tabs[1]?.focus();

    await act(async () => {
      tabs[1]?.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }) as unknown as Event);
    });

    expect(onChange).toHaveBeenCalledWith(2);
    expect(document.activeElement).toBe(tabs[2]);
    expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, -1, 0]);
  });

  it("supports Home and End without trapping unrelated keyboard input", async () => {
    const { onChange, tabs } = await mount(1);
    tabs[1]?.focus();

    await act(async () => {
      tabs[1]?.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Home", bubbles: true }) as unknown as Event);
    });
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(document.activeElement).toBe(tabs[0]);

    await act(async () => {
      tabs[0]?.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "End", bubbles: true }) as unknown as Event);
    });
    expect(onChange).toHaveBeenLastCalledWith(2);
    expect(document.activeElement).toBe(tabs[2]);

    const event = new dom.KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    tabs[2]?.dispatchEvent(event as unknown as Event);
    expect(event.defaultPrevented).toBe(false);
  });
});
