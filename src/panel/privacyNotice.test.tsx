import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PrivacyNotice, shouldShowPrivacyNotice } from "./privacyNotice.js";

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

describe("privacy notice", () => {
  it("is visible until a true dismissal value is stored", () => {
    expect(shouldShowPrivacyNotice(undefined)).toBe(true);
    expect(shouldShowPrivacyNotice(false)).toBe(true);
    expect(shouldShowPrivacyNotice(true)).toBe(false);
    expect(shouldShowPrivacyNotice("true")).toBe(true);
  });

  it("renders a concise local data-use disclosure and dismiss action", async () => {
    const onDismiss = vi.fn();
    await act(async () => {
      render(<PrivacyNotice onDismiss={onDismiss} />, container);
    });

    expect(container.textContent).toContain("Graphy reads LeetCode editor, custom testcase, and Run output locally");
    expect(container.textContent).toContain("does not send this data to a Graphy server");
    expect(container.querySelector("button")?.textContent).toBe("Got it");
    await act(async () => {
      container.querySelector("button")?.dispatchEvent(new dom.Event("click", { bubbles: true }) as unknown as Event);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
