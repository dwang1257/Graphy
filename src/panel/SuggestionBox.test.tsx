import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { SuggestionBox } from "./SuggestionBox.js";

let dom: Window;
let container: HTMLDivElement;
let fetchMock: Mock<(url: string, init: RequestInit) => Promise<Response>>;

beforeEach(() => {
  dom = new Window();
  vi.stubGlobal("window", dom);
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("navigator", dom.navigator);
  vi.stubGlobal("HTMLElement", dom.HTMLElement);
  vi.stubGlobal("Node", dom.Node);
  vi.stubGlobal("chrome", { runtime: { getManifest: () => ({ version: "9.8.7" }) } });
  fetchMock = vi.fn(async () => new Response(null));
  vi.stubGlobal("fetch", fetchMock);
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(() => {
  render(null, container);
  vi.unstubAllGlobals();
});

async function mount(shrunk = false, slug = "two-sum") {
  await act(async () => {
    render(<SuggestionBox shrunk={shrunk} slug={slug} />, container);
  });
  return container.querySelector<HTMLButtonElement>(".suggest-btn")!;
}

function popover(): HTMLElement | null {
  return container.querySelector(".suggest-popover");
}

function field(): HTMLTextAreaElement {
  return container.querySelector<HTMLTextAreaElement>(".suggest-field")!;
}

function button(label: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>(".suggest-popover button")].find((el) => el.textContent === label)!;
}

async function click(el: HTMLElement) {
  await act(async () => {
    el.click();
  });
}

async function type(value: string) {
  await act(async () => {
    const el = field();
    el.value = value;
    el.dispatchEvent(new dom.Event("input", { bubbles: true }) as unknown as Event);
  });
}

async function key(target: EventTarget, init: { key: string; metaKey?: boolean; ctrlKey?: boolean }) {
  await act(async () => {
    target.dispatchEvent(new dom.KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init }) as unknown as Event);
  });
}

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

function sentBody(): URLSearchParams {
  const init = fetchMock.mock.calls[0]?.[1];
  return init?.body as URLSearchParams;
}

describe("SuggestionBox", () => {
  it("toggles a suggestion dialog from the lightbulb", async () => {
    const trigger = await mount();

    expect(trigger.getAttribute("aria-label")).toBe("Send a suggestion");
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.querySelector("svg")).not.toBeNull();
    expect(popover()).toBeNull();

    await click(trigger);
    expect(popover()?.getAttribute("role")).toBe("dialog");
    expect(popover()?.getAttribute("aria-label")).toBe("Send a suggestion");
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(trigger.getAttribute("aria-controls")).toBe(popover()?.id);
    expect(document.activeElement).toBe(field());
    expect(field().maxLength).toBe(2000);
    expect(field().placeholder).toBe("Share an idea or report a problem");

    await click(trigger);
    expect(popover()).toBeNull();
  });

  it("keeps Send disabled until there is text", async () => {
    await click(await mount());
    expect(button("Send").disabled).toBe(true);

    await type("   \n ");
    expect(button("Send").disabled).toBe(true);

    await type("Show edge weights");
    expect(button("Send").disabled).toBe(false);
  });

  it("selects one kind at a time and deselects on a second click", async () => {
    await click(await mount());
    const feature = button("Feature");
    const bug = button("Bug");

    await click(feature);
    expect(feature.getAttribute("aria-pressed")).toBe("true");

    await click(bug);
    expect(feature.getAttribute("aria-pressed")).toBe("false");
    expect(bug.getAttribute("aria-pressed")).toBe("true");

    await click(bug);
    expect(bug.getAttribute("aria-pressed")).toBe("false");
  });

  it("sends with the kind and hidden context, then thanks and clears the draft", async () => {
    const trigger = await mount(false, "number-of-islands");
    await click(trigger);
    await click(button("Speed"));
    await type("  Faster layout please  ");
    await click(button("Send"));
    await settle();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1].mode).toBe("no-cors");
    expect(sentBody().get("entry.1514885710")).toBe("Performance improvement");
    expect(sentBody().get("entry.1464379200")).toBe("Faster layout please\n\n---\nGraphy 9.8.7 | number-of-islands");
    expect(popover()?.textContent).toContain("Thanks! Your suggestion was sent.");
    expect(container.querySelector(".suggest-field")).toBeNull();

    await click(button("Close"));
    expect(popover()).toBeNull();

    await click(trigger);
    expect(field().value).toBe("");
    expect(container.querySelector(".segment[aria-pressed='true']")).toBeNull();
  });

  it("sends with Cmd or Ctrl+Enter and omits the kind when none is chosen", async () => {
    await click(await mount(false, ""));
    await type("Idea");

    await key(field(), { key: "Enter" });
    expect(fetchMock).not.toHaveBeenCalled();

    await key(field(), { key: "Enter", metaKey: true });
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(sentBody().has("entry.1514885710")).toBe(false);
    expect(sentBody().get("entry.1464379200")).toBe("Idea\n\n---\nGraphy 9.8.7 | no problem");

    await click(button("Close"));
    await click(container.querySelector<HTMLButtonElement>(".suggest-btn")!);
    await type("Another");
    await key(field(), { key: "Enter", ctrlKey: true });
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows sending progress and blocks duplicate sends", async () => {
    let finish: (value: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => (finish = resolve)));
    await click(await mount());
    await type("Slow network");
    await click(button("Send"));

    const sending = button("Sending…");
    expect(sending.disabled).toBe(true);
    await key(field(), { key: "Enter", metaKey: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      finish(new Response(null));
    });
    await settle();
    expect(popover()?.textContent).toContain("Thanks!");
  });

  it("keeps the draft and explains a failed send", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await click(await mount());
    await click(button("Bug"));
    await type("Crash on empty input");
    await click(button("Send"));
    await settle();

    const alert = container.querySelector("[role='alert']");
    expect(alert?.textContent).toBe("Couldn't send. Check your connection and try again.");
    expect(field().value).toBe("Crash on empty input");
    expect(button("Bug").getAttribute("aria-pressed")).toBe("true");
    expect(button("Send").disabled).toBe(false);

    await click(button("Send"));
    await settle();
    expect(container.querySelector("[role='alert']")).toBeNull();
    expect(popover()?.textContent).toContain("Thanks!");
  });

  it("keeps the draft when closed by Escape, an outside click, or Cancel", async () => {
    const trigger = await mount();
    const outside = document.createElement("div");
    document.body.append(outside);

    await click(trigger);
    await click(button("Feature"));
    await type("Draft idea");

    await key(document, { key: "Escape" });
    expect(popover()).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await click(trigger);
    expect(field().value).toBe("Draft idea");
    expect(button("Feature").getAttribute("aria-pressed")).toBe("true");

    await act(async () => {
      field().dispatchEvent(new dom.PointerEvent("pointerdown", { bubbles: true }) as unknown as Event);
    });
    expect(popover()).not.toBeNull();

    await act(async () => {
      outside.dispatchEvent(new dom.PointerEvent("pointerdown", { bubbles: true }) as unknown as Event);
    });
    expect(popover()).toBeNull();

    await click(trigger);
    expect(field().value).toBe("Draft idea");
    await click(button("Cancel"));
    expect(popover()).toBeNull();

    await click(trigger);
    expect(field().value).toBe("Draft idea");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("waits for the panel to expand before showing the dialog", async () => {
    await click(await mount(true));
    expect(popover()).toBeNull();

    await act(async () => {
      render(<SuggestionBox shrunk={false} slug="two-sum" />, container);
    });
    expect(popover()).not.toBeNull();
  });

  it("never renders the hidden context", async () => {
    await click(await mount(false, "two-sum"));
    await type("Visible text");
    const html = container.innerHTML;

    expect(html).not.toContain("Graphy 9.8.7");
    expect(html).not.toContain("two-sum");
    expect(html).not.toContain("---");
  });
});
