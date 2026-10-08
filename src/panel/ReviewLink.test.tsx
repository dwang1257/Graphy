import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REVIEW_URL, ReviewLink } from "./ReviewLink.js";

let dom: Window;
let container: HTMLDivElement;
let store: Record<string, unknown>;

beforeEach(() => {
  dom = new Window();
  vi.stubGlobal("window", dom);
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("navigator", dom.navigator);
  vi.stubGlobal("HTMLElement", dom.HTMLElement);
  vi.stubGlobal("Node", dom.Node);
  store = {};
  vi.stubGlobal("chrome", {
    storage: {
      sync: {
        get: vi.fn(async (key: string) => (key in store ? { [key]: store[key] } : {})),
        set: vi.fn(async (items: Record<string, unknown>) => Object.assign(store, items)),
      },
    },
  });
  container = document.createElement("div");
  document.body.append(container);
});

afterEach(() => {
  render(null, container);
  vi.unstubAllGlobals();
});

async function mount(shrunk = false) {
  await act(async () => {
    render(<ReviewLink shrunk={shrunk} />, container);
  });
  await act(async () => {});
  return container.querySelector<HTMLAnchorElement>(".review-link");
}

async function press(link: HTMLAnchorElement) {
  link.addEventListener("click", (event) => event.preventDefault(), { once: true });
  await act(async () => {
    link.click();
  });
}

function prompt(): Element | null {
  return container.querySelector(".review-prompt");
}

function button(label: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>(".review-prompt button")].find((el) => el.textContent === label)!;
}

describe("ReviewLink", () => {
  it("links to the store reviews in a new tab without a prompt until clicked", async () => {
    const link = await mount();

    expect(link?.getAttribute("href")).toBe(REVIEW_URL);
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link?.getAttribute("aria-label")).toBe("Review Graphy on the Chrome Web Store");
    expect(prompt()).toBeNull();
  });

  it("offers to hide itself for good after a click", async () => {
    await press((await mount())!);
    expect(prompt()?.textContent).toContain("Thanks for supporting Graphy!");

    await act(async () => {
      button("Don't show again").click();
    });
    expect(container.querySelector(".review")).toBeNull();
    expect(store["graphy.reviewHidden"]).toBe(true);

    render(null, container);
    expect(await mount()).toBeNull();
  });

  it("closes the prompt but keeps the link", async () => {
    const link = (await mount())!;
    await press(link);
    await act(async () => {
      button("Close").click();
    });
    expect(prompt()).toBeNull();
    expect(container.querySelector(".review-link")).not.toBeNull();
    expect(store["graphy.reviewHidden"]).toBeUndefined();

    await press(link);
    await act(async () => {
      document.dispatchEvent(new dom.KeyboardEvent("keydown", { key: "Escape" }) as unknown as Event);
    });
    expect(prompt()).toBeNull();
  });

  it("waits for the panel to expand before showing the prompt", async () => {
    await press((await mount(true))!);
    expect(prompt()).toBeNull();
    await act(async () => {
      render(<ReviewLink shrunk={false} />, container);
    });
    expect(prompt()).not.toBeNull();
  });
});
