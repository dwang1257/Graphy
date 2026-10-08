import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { initialTopology } from "../core/scene.js";
import type { TraceFrame } from "../core/trace.js";
import { TracePlayback } from "./TracePlayback.js";

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

function frame(patch: Partial<TraceFrame>): TraceFrame {
  return {
    topology: initialTopology([]),
    layoutKey: "",
    labels: {},
    pointers: {},
    visited: [],
    frontier: [],
    dimmed: [],
    notes: {},
    ...patch,
  };
}

async function mount(frames: TraceFrame[], index: number) {
  await act(async () => {
    render(
      <TracePlayback frames={frames} index={index} playing={false} onIndexChange={vi.fn()} onPlayingChange={vi.fn()} />,
      container,
    );
  });
  return [...container.querySelectorAll(".trace-watch-item")].map((item) => [
    item.getAttribute("data-state"),
    item.textContent,
  ]);
}

describe("TracePlayback", () => {
  const frames = [
    frame({}),
    frame({ current: "a0.0", pointers: { "r,c": "a0.0" } }),
    frame({ current: "a1.0", pointers: { "r,c": "a0.0", "nr,nc": "a1.0" } }),
  ];

  it("lists every grid pointer of the trace with its cell for the shown step", async () => {
    expect(await mount(frames, 2)).toEqual([
      ["pointer", "r,c(0, 0)"],
      ["current", "nr,nc(1, 0)"],
    ]);
    expect(await mount(frames, 0)).toEqual([
      ["gone", "r,c–"],
      ["gone", "nr,nc–"],
    ]);
  });

  it("names the per-node value shown beside graph nodes", async () => {
    const graph = [frame({}), frame({ note: "indeg", notes: { indeg: { a0: "1" } } })];
    expect(await mount(graph, 1)).toEqual([["note", "indegbeside nodes"]]);
    expect(await mount(graph, 0)).toEqual([["gone", "valuesbeside nodes"]]);
  });

  it("leaves out the pointer row when no step points into a grid", async () => {
    expect(await mount([frame({}), frame({ current: "a1", pointers: { node: "a1" } })], 1)).toEqual([]);
    expect(container.querySelector(".trace-watch")).toBeNull();
    expect(container.querySelector(".trace-playback")).not.toBeNull();
  });
});
