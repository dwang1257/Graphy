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

describe("pointerDragHandler", () => {
  it("coalesces pointer moves to one callback per animation frame", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
      frames.push(cb);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      delete frames[id - 1];
    });

    const moves: Array<[number, number]> = [];
    const target = document.createElement("div");
    target.setPointerCapture = () => undefined;
    document.body.append(target);
    const onDown = pointerDragHandler<HTMLDivElement>({
      coords: "client",
      onMove: (dx, dy) => moves.push([dx, dy]),
    });

    onDown({
      button: 0,
      currentTarget: target,
      target,
      pointerId: 1,
      screenX: 0,
      screenY: 0,
      clientX: 10,
      clientY: 20,
    } as unknown as Parameters<typeof onDown>[0]);

    target.dispatchEvent(new dom.PointerEvent("pointermove", { clientX: 14, clientY: 22 }) as unknown as Event);
    target.dispatchEvent(new dom.PointerEvent("pointermove", { clientX: 18, clientY: 26 }) as unknown as Event);
    expect(moves).toEqual([]);
    expect(frames).toHaveLength(1);

    frames[0]?.(0);
    expect(moves).toEqual([[8, 6]]);
  });
});
