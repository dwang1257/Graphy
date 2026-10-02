import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PLACEHOLDER } from "../core/dot/paintRoles.js";
import { initialTopology } from "../core/scene.js";
import type { TraceFrame } from "../core/trace.js";
import { DEFAULT_SETTINGS } from "../settings/schema.js";
import { GESTURE_CLASS, GESTURE_IDLE_MS, GraphView } from "./GraphView.js";
import { svgPaint, type SvgPaint } from "./svgPaint.js";

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><g class="graph">
<g class="node"><title>a0</title><ellipse cx="20" cy="-30" rx="20" ry="20" fill="${PLACEHOLDER.nodeFill}" stroke="${PLACEHOLDER.nodeStroke}"/><text fill="${PLACEHOLDER.nodeInk}" onclick="alert(1)">1</text></g>
</g></svg>`;

const frame: TraceFrame = {
  topology: initialTopology([]),
  layoutKey: "",
  labels: {},
  pointers: {},
  visited: ["a0"],
  frontier: [],
  dimmed: [],
};

let dom: Window;
let container: HTMLDivElement;
let resize: (() => void) | undefined;

function stageBox(width: number, height: number): void {
  const stage = container.querySelector(".stage") as HTMLElement;
  stage.getBoundingClientRect = () => ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON: () => ({}) });
}

async function show(paint: SvgPaint, fitKey = "a", traceFrame: TraceFrame | null = null): Promise<void> {
  await act(async () => {
    render(<GraphView svg={SVG} fitKey={fitKey} paint={paint} traceFrame={traceFrame} />, container);
  });
}

const viewport = (): HTMLElement => container.querySelector(".viewport") as HTMLElement;
const ellipse = (): Element => container.querySelector("ellipse")!;

beforeEach(() => {
  vi.useFakeTimers();
  dom = new Window();
  Object.assign(dom, { setTimeout, clearTimeout });
  vi.stubGlobal("window", dom);
  vi.stubGlobal("document", dom.document);
  vi.stubGlobal("DOMParser", dom.DOMParser);
  vi.stubGlobal("XMLSerializer", dom.XMLSerializer);
  vi.stubGlobal("getComputedStyle", dom.getComputedStyle.bind(dom));
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => setTimeout(() => fn(0), 16));
  vi.stubGlobal("cancelAnimationFrame", (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: () => void) {
      resize = callback;
    }
    observe(): void {}
    disconnect(): void {}
  });
  container = document.createElement("div") as unknown as HTMLDivElement;
  document.body.append(container as unknown as Node);
});

afterEach(() => {
  render(null, container);
  resize = undefined;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("GraphView", () => {
  it("paints placeholder roles with the palette and strips event handlers", async () => {
    await show(svgPaint(DEFAULT_SETTINGS.light, null, undefined));
    expect(ellipse().getAttribute("fill")).toBe(DEFAULT_SETTINGS.light.nodeFill);
    expect(ellipse().getAttribute("stroke")).toBe(DEFAULT_SETTINGS.light.nodeStroke);
    expect(container.querySelector("text")?.hasAttribute("onclick")).toBe(false);
  });

  it("repaints colors in place, keeping the live svg and its trace overlay", async () => {
    await show(svgPaint(DEFAULT_SETTINGS.light, null, undefined), "a", frame);
    const svg = container.querySelector("svg");
    const node = container.querySelector("g.node")!;
    expect(node.getAttribute("data-graphy-state")).toBe("visited");
    expect(node.getAttribute("data-graphy-tone")).toBe("light");

    await show(svgPaint({ ...DEFAULT_SETTINGS.light, nodeFill: "#111111" }, null, undefined), "a", frame);
    expect(container.querySelector("svg")).toBe(svg);
    expect(ellipse().getAttribute("fill")).toBe("#111111");
    expect(node.getAttribute("data-graphy-state")).toBe("visited");
    expect(node.getAttribute("data-graphy-tone")).toBe("dark");
  });

  it("does not re-render for identical props", async () => {
    const paint = svgPaint(DEFAULT_SETTINGS.light, null, undefined);
    await show(paint);
    ellipse().setAttribute("data-probe", "kept");
    await show(paint);
    expect(ellipse().getAttribute("data-probe")).toBe("kept");
  });

  it("flags the viewport while a wheel gesture is active", async () => {
    await show(svgPaint(DEFAULT_SETTINGS.light, null, undefined));
    const stage = container.querySelector(".stage")!;
    stage.dispatchEvent(new dom.WheelEvent("wheel", { deltaY: 10, cancelable: true }) as unknown as Event);
    expect(viewport().classList.contains(GESTURE_CLASS)).toBe(true);
    vi.advanceTimersByTime(GESTURE_IDLE_MS - 10);
    stage.dispatchEvent(new dom.WheelEvent("wheel", { deltaY: 10, cancelable: true }) as unknown as Event);
    vi.advanceTimersByTime(GESTURE_IDLE_MS - 10);
    expect(viewport().classList.contains(GESTURE_CLASS)).toBe(true);
    vi.advanceTimersByTime(20);
    expect(viewport().classList.contains(GESTURE_CLASS)).toBe(false);
  });

  it("refits on resize once per frame until the user moves the view", async () => {
    await show(svgPaint(DEFAULT_SETTINGS.light, null, undefined));
    stageBox(424, 224);
    resize?.();
    resize?.();
    vi.advanceTimersByTime(16);
    expect(viewport().style.transform).toBe("translate(52px, 32px) scale(1.6)");

    const stage = container.querySelector(".stage")!;
    stage.dispatchEvent(new dom.WheelEvent("wheel", { deltaY: 10, cancelable: true }) as unknown as Event);
    vi.advanceTimersByTime(16);
    const zoomed = viewport().style.transform;
    stageBox(824, 424);
    resize?.();
    vi.advanceTimersByTime(16);
    expect(viewport().style.transform).toBe(zoomed);

    await show(svgPaint(DEFAULT_SETTINGS.light, null, undefined), "b");
    expect(viewport().style.transform).not.toBe(zoomed);
  });
});
