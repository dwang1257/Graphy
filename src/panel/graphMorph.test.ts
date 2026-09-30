import { Window } from "happy-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { animateGraphMorph, createMorphGeneration } from "./graphMorph.js";

describe("morph generation", () => {
  it("invalidates an older morph when a newer frame starts", () => {
    const generation = createMorphGeneration();
    const first = generation.next();
    const second = generation.next();

    expect(generation.isCurrent(first)).toBe(false);
    expect(generation.isCurrent(second)).toBe(true);
  });
});

describe("animateGraphMorph", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("cancels pending animation timers instead of touching a detached tree", () => {
    vi.useFakeTimers();
    const dom = new Window();
    vi.stubGlobal("window", dom);
    vi.stubGlobal("document", dom.document);
    const cancelRaf = vi.fn((id: number) => {
      window.clearTimeout(id);
    });
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      return window.setTimeout(() => cb(0), 0) as unknown as number;
    });
    vi.stubGlobal("cancelAnimationFrame", cancelRaf);

    const from = document.createElement("svg");
    const to = document.createElement("svg");
    const node = document.createElementNS("http://www.w3.org/2000/svg", "g");
    node.setAttribute("class", "node");
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = "a0";
    const shape = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    shape.setAttribute("cx", "10");
    shape.setAttribute("cy", "10");
    node.append(title, shape);
    to.append(node);

    const { done, cancel } = animateGraphMorph({ fromRoot: from, toRoot: to });
    cancel();
    vi.runAllTimers();

    expect(cancelRaf).toHaveBeenCalled();
    return expect(done).resolves.toBeUndefined();
  });
});

describe("morph ghosts", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("ghosts nodes that exist only in the previous layout", () => {
    const dom = new Window();
    vi.stubGlobal("window", dom);
    vi.stubGlobal("requestAnimationFrame", () => 0);
    vi.stubGlobal("cancelAnimationFrame", () => undefined);
    const parser = new dom.DOMParser();
    const svg = (ids: string[]) => parser.parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg"><g class="graph">${ids.map((id) => `<g class="node"><title>${id}</title><ellipse cx="1" cy="1"/></g>`).join("")}</g></svg>`,
      "image/svg+xml",
    ).documentElement as unknown as Element;
    const from = svg(["a0", "a1", "z0", "a1~", "t_a"]);
    const to = svg(["a0", "t_b"]);
    animateGraphMorph({ fromRoot: from, toRoot: to }).cancel();
    const handle = animateGraphMorph({ fromRoot: from, toRoot: to });
    expect([...to.querySelectorAll('[data-graphy-state="deleted"]')].map((el) => el.getAttribute("data-graphy-id"))).toEqual(["a1", "z0"]);
    handle.cancel();
    expect(to.querySelectorAll('[data-graphy-state="deleted"]')).toHaveLength(0);
  });
});
