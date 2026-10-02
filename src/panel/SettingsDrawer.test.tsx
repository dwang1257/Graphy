import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { DARK, DEFAULT_SETTINGS, LIGHT, type Settings } from "../settings/schema.js";
import { DRAWER_EXIT_MS, SettingsDrawer, type SettingsUpdate } from "./SettingsDrawer.js";
import { STYLE_DRAWER_ID } from "./styleOptions.js";

let dom: Window;
let container: HTMLDivElement;

beforeEach(() => {
  vi.useFakeTimers();
  dom = new Window();
  vi.stubGlobal("window", dom);
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("navigator", dom.navigator);
  vi.stubGlobal("HTMLElement", dom.HTMLElement);
  vi.stubGlobal("Element", dom.Element);
  vi.stubGlobal("Node", dom.Node);
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(() => {
  render(null, container);
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

type OnChange = Mock<(update: SettingsUpdate) => void>;

function apply(onChange: OnChange, start: Settings = DEFAULT_SETTINGS): Settings {
  return onChange.mock.calls.reduce<Settings>((current, [update]) => (typeof update === "function" ? update(current) : update), start);
}

async function mount(options: { settings?: Settings; onClose?: () => void } = {}) {
  const onChange: OnChange = vi.fn();
  const onClose = options.onClose ?? vi.fn();
  const settings = options.settings ?? DEFAULT_SETTINGS;
  await act(async () => {
    render(<SettingsDrawer settings={settings} activePalette={settings.mode} onChange={onChange} onClose={onClose} />, container);
  });
  const dialog = container.querySelector<HTMLElement>("[role=dialog]");
  if (!dialog) throw new Error("drawer did not render");
  return { dialog, onChange, onClose };
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll<HTMLButtonElement>("button")).find(
    (element) => element.getAttribute("aria-label") === label || element.textContent?.trim() === label,
  );
  if (!found) throw new Error(`no button ${label}`);
  return found;
}

async function click(element: Element): Promise<void> {
  await act(async () => {
    element.dispatchEvent(new dom.MouseEvent("click", { bubbles: true, cancelable: true }) as unknown as Event);
  });
}

async function key(target: EventTarget, name: string): Promise<KeyboardEvent> {
  const event = new dom.KeyboardEvent("keydown", { key: name, bubbles: true, cancelable: true }) as unknown as KeyboardEvent;
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}

async function input(element: HTMLInputElement, value: string): Promise<void> {
  await act(async () => {
    element.value = value;
    element.dispatchEvent(new dom.Event("input", { bubbles: true }) as unknown as Event);
  });
}

async function finishExit(): Promise<void> {
  await act(async () => {
    vi.advanceTimersByTime(DRAWER_EXIT_MS);
  });
}

describe("SettingsDrawer", () => {
  it("is a labelled non-modal dialog that focuses the active theme on open", async () => {
    const { dialog } = await mount();

    expect(dialog.id).toBe(STYLE_DRAWER_ID);
    expect(dialog.hasAttribute("aria-modal")).toBe(false);
    expect(container.querySelector(`#${dialog.getAttribute("aria-labelledby")}`)?.textContent).toBe("Style");
    expect(document.activeElement).toBe(button("Dark"));
    expect(dialog.querySelector("header [role=group]")?.getAttribute("aria-label")).toBe("Theme");
  });

  it("offers exactly three node shapes and three edge lines", async () => {
    await mount();
    const options = (label: string) =>
      Array.from(container.querySelectorAll(`[role=group][aria-label='${label}'] button`)).map((element) => element.textContent);

    expect(options("Node shape")).toEqual(["Circle", "Square", "Diamond"]);
    expect(options("Edge line")).toEqual(["Solid", "Dashed", "Dotted"]);
  });

  it("closes on Escape after the exit animation and returns focus to the trigger", async () => {
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();
    const onClose = vi.fn();
    const { dialog } = await mount({ onClose });

    await key(document.body, "Escape");
    expect(dialog.classList.contains("is-closing")).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    await finishExit();
    expect(onClose).toHaveBeenCalledOnce();

    await act(async () => {
      render(null, container);
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("light-dismisses on outside pointerdown but ignores the drawer and title bar", async () => {
    const titlebar = document.createElement("div");
    titlebar.className = "titlebar";
    const stage = document.createElement("div");
    document.body.append(titlebar, stage);
    const onClose = vi.fn();
    const { dialog } = await mount({ onClose });
    const pointerdown = (target: Element) =>
      act(async () => {
        target.dispatchEvent(new dom.PointerEvent("pointerdown", { bubbles: true }) as unknown as Event);
      });

    await pointerdown(dialog);
    await pointerdown(titlebar);
    await finishExit();
    expect(onClose).not.toHaveBeenCalled();

    await pointerdown(stage);
    await finishExit();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("owns the toggle click so the trigger closes it with the exit animation", async () => {
    const toggleClick = vi.fn();
    const toggle = document.createElement("button");
    toggle.setAttribute("aria-controls", STYLE_DRAWER_ID);
    toggle.addEventListener("click", toggleClick);
    document.body.append(toggle);
    const onClose = vi.fn();
    await mount({ onClose });

    await click(toggle);
    expect(toggleClick).not.toHaveBeenCalled();
    await finishExit();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("applies segment, switch, and theme changes through updaters", async () => {
    const { onChange } = await mount();

    await click(button("Diamond"));
    await click(button("Dashed"));
    await click(button("Light"));
    await click(container.querySelector("label[for='graphy-style-arrowheads']") as Element);

    const next = apply(onChange);
    expect(onChange.mock.calls.every(([update]) => typeof update === "function")).toBe(true);
    expect(next.layout.nodeShape).toBe("diamond");
    expect(next.layout.edgeStyle).toBe("dashed");
    expect(next.mode).toBe("light");
    expect(next.layout.showArrowheads).toBe(false);
    expect(container.querySelector("[role=switch]")?.getAttribute("aria-checked")).toBe("true");
  });

  it("returns the same settings object when a segment is already selected", async () => {
    const { onChange } = await mount();

    await click(button("Circle"));
    expect(apply(onChange)).toBe(DEFAULT_SETTINGS);
  });

  it("writes colors to the active theme only and reports every picker event", async () => {
    const { onChange } = await mount();
    const picker = container.querySelector<HTMLInputElement>("input[aria-label='Fill picker']");
    if (!picker) throw new Error("no picker");

    await input(picker, "#112233");
    await input(picker, "#223344");
    await input(picker, "#334455");

    expect(onChange).toHaveBeenCalledTimes(3);
    const next = apply(onChange);
    expect(next.dark.nodeFill).toBe("#334455");
    expect(next.light).toBe(DEFAULT_SETTINGS.light);
  });

  it("applies typed hex only when valid and reverts invalid drafts on blur", async () => {
    const { onChange } = await mount();
    const field = container.querySelector<HTMLInputElement>("#graphy-style-edge-color");
    if (!field) throw new Error("no hex field");

    await input(field, "#12");
    expect(onChange).not.toHaveBeenCalled();
    expect(field.getAttribute("aria-invalid")).toBe("false");

    await input(field, "#12zz");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector(".color-field-flag")).not.toBeNull();

    await act(async () => {
      field.dispatchEvent(new dom.FocusEvent("blur") as unknown as Event);
    });
    expect(field.value).toBe(DARK.edgeColor);
    expect(onChange).not.toHaveBeenCalled();

    await input(field, "#abc");
    expect(onChange).not.toHaveBeenCalled();
    await key(field, "Enter");
    expect(apply(onChange).dark.edgeColor).toBe("#aabbcc");

    await input(field, "#A0B1C2");
    expect(apply(onChange).dark.edgeColor).toBe("#a0b1c2");
  });

  it("lets Escape revert a hex draft without closing the drawer", async () => {
    const onClose = vi.fn();
    await mount({ onClose });
    const field = container.querySelector<HTMLInputElement>("#graphy-style-canvas-color");
    if (!field) throw new Error("no hex field");

    await input(field, "#0");
    const event = await key(field, "Escape");
    expect(event.defaultPrevented).toBe(true);
    expect(field.value).toBe(DARK.background);
    await finishExit();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("marks the preset matching the current color", async () => {
    await mount();
    const pressed = Array.from(container.querySelectorAll(".swatch[aria-pressed='true']")).map((swatch) =>
      swatch.getAttribute("aria-label"),
    );
    expect(pressed).toEqual(["Aubergine", "Ash", "Ink"]);
  });

  it("resets only the active theme's colors and offers undo", async () => {
    const custom: Settings = {
      ...DEFAULT_SETTINGS,
      mode: "light",
      layout: { ...DEFAULT_SETTINGS.layout, nodeShape: "diamond" },
      light: { ...LIGHT, nodeFill: "#123456", background: "#654321" },
      dark: { ...DARK, edgeColor: "#abcdef" },
    };
    const { onChange } = await mount({ settings: custom });
    const reset = button("Reset Light theme");
    expect(reset.getAttribute("aria-disabled")).toBe("false");

    await click(reset);
    const afterReset = apply(onChange, custom);
    expect(afterReset.light).toEqual(LIGHT);
    expect(afterReset.dark).toBe(custom.dark);
    expect(afterReset.layout).toBe(custom.layout);

    await act(async () => {
      render(<SettingsDrawer settings={afterReset} activePalette="light" onChange={onChange} onClose={vi.fn()} />, container);
    });
    expect(container.querySelector("[role=status]")?.textContent).toBe("Light colors restored to defaults.");
    await click(button("Undo reset"));
    expect(apply(onChange, custom).light).toEqual(custom.light);
  });

  it("disables reset when the active theme already uses defaults", async () => {
    const { onChange } = await mount();
    const reset = button("Reset Dark theme");

    expect(reset.getAttribute("aria-disabled")).toBe("true");
    await click(reset);
    expect(onChange).not.toHaveBeenCalled();
  });
});
