import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS } from "../settings/schema.js";
import { SettingsDrawer } from "./SettingsDrawer.js";

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

function props(onClose: () => void) {
  return {
    settings: DEFAULT_SETTINGS,
    activePalette: "dark" as const,
    onChange: vi.fn(),
    onClose,
  };
}

describe("SettingsDrawer", () => {
  it("uses labelled dialog semantics and focuses the close control on open", async () => {
    const trigger = document.createElement("button");
    trigger.type = "button";
    document.body.append(trigger);
    trigger.focus();

    await act(async () => {
      render(<SettingsDrawer {...props(vi.fn())} />, container);
    });

    const dialog = container.querySelector<HTMLElement>("[role=dialog]");
    const close = container.querySelector<HTMLButtonElement>("button[aria-label='Close style panel']");
    expect(dialog?.getAttribute("aria-labelledby")).toBe("style-rail-title");
    expect(dialog?.getAttribute("aria-modal")).toBe("true");
    expect(container.querySelector("#style-rail-title")?.textContent).toBe("Style your graph");
    expect(document.activeElement).toBe(close);
  });

  it("closes on Escape and restores focus when dismissed", async () => {
    const onClose = vi.fn();
    const trigger = document.createElement("button");
    document.body.append(trigger);
    trigger.focus();

    await act(async () => {
      render(<SettingsDrawer {...props(onClose)} />, container);
    });
    const dialog = container.querySelector<HTMLElement>("[role=dialog]");

    await act(async () => {
      dialog?.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Escape", bubbles: true }) as unknown as Event);
    });
    expect(onClose).toHaveBeenCalledOnce();

    await act(async () => {
      render(null, container);
    });
    expect(document.activeElement).toBe(trigger);
  });

  it("wraps Tab focus between visible enabled controls", async () => {
    await act(async () => {
      render(<SettingsDrawer {...props(vi.fn())} />, container);
    });
    const dialog = container.querySelector<HTMLElement>("[role=dialog]");
    const close = container.querySelector<HTMLButtonElement>("button[aria-label='Close style panel']");
    const reset = container.querySelector<HTMLButtonElement>("button.btn:not(.icon-btn)");
    const hidden = document.createElement("button");
    hidden.type = "button";
    hidden.hidden = true;
    const disabled = document.createElement("button");
    disabled.type = "button";
    disabled.disabled = true;
    dialog?.append(hidden, disabled);

    reset?.focus();
    await act(async () => {
      dialog?.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Tab", bubbles: true }) as unknown as Event);
    });
    expect(document.activeElement).toBe(close);

    close?.focus();
    await act(async () => {
      dialog?.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }) as unknown as Event);
    });
    expect(document.activeElement).toBe(reset);
  });
});
