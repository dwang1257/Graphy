import { Window } from "happy-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pointerDragHandler } from "./usePointerDrag.js";

let dom: Window;

beforeEach(() => {
  dom = new Window();
  vi.stubGlobal("window", dom);
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("HTMLElement", dom.HTMLElement);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function setup(options: Partial<Parameters<typeof pointerDragHandler>[0]> = {}) {
  const moves: Array<[number, number]> = [];
  const events: string[] = [];
  const target = document.createElement("div");
  const button = document.createElement("button");
  target.append(button);
  target.setPointerCapture = () => undefined;
  document.body.append(target);
  const onDown = pointerDragHandler<HTMLDivElement>({
    onStart: () => events.push("start"),
    onMove: (dx, dy) => moves.push([dx, dy]),
    onEnd: () => events.push("end"),
    ...options,
  });
  const down = (from: Element = target, button = 0) =>
    onDown({
      button,
      currentTarget: target,
      target: from,
      pointerId: 1,
      screenX: 100,
      screenY: 200,
      clientX: 10,
      clientY: 20,
    } as unknown as Parameters<typeof onDown>[0]);
  const fire = (type: string, init: { clientX?: number; clientY?: number; screenX?: number; screenY?: number }) =>
    target.dispatchEvent(new dom.PointerEvent(type, init) as unknown as Event);
  return { moves, events, button, down, fire };
}

describe("pointerDragHandler", () => {
  it("reports every pointer move immediately without waiting for a frame", () => {
    const raf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    const { moves, down, fire } = setup({ coords: "client" });
    down();
    fire("pointermove", { clientX: 14, clientY: 22 });
    expect(moves).toEqual([[4, 2]]);
    fire("pointermove", { clientX: 18, clientY: 26 });
    expect(moves).toEqual([
      [4, 2],
      [4, 4],
    ]);
    expect(raf).not.toHaveBeenCalled();
  });

  it("uses screen coordinates by default and skips moves without motion", () => {
    const { moves, down, fire } = setup();
    down();
    fire("pointermove", { screenX: 100, screenY: 200, clientX: 50, clientY: 50 });
    fire("pointermove", { screenX: 103, screenY: 195, clientX: 10, clientY: 20 });
    expect(moves).toEqual([[3, -5]]);
  });

  it("ends the drag on pointerup and stops listening", () => {
    const { moves, events, down, fire } = setup({ coords: "client" });
    down();
    fire("pointermove", { clientX: 12, clientY: 20 });
    fire("pointerup", { clientX: 12, clientY: 20 });
    fire("pointermove", { clientX: 40, clientY: 40 });
    expect(moves).toEqual([[2, 0]]);
    expect(events).toEqual(["start", "end"]);
  });

  it("ignores secondary buttons and ignored targets", () => {
    const { events, button, down } = setup({ ignore: "button" });
    down(button);
    down(undefined, 2);
    expect(events).toEqual([]);
  });
});
