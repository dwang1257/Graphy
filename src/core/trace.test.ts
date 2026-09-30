import { describe, expect, it } from "vitest";

import { buildTrace, EMPTY_TRACE, MAX_TRACE_FRAMES, parseAutoLine } from "./trace.js";
import { TRACE_SENTINEL } from "./traceWire.js";
import type { GraphModel, Links, Pane } from "./types.js";

const S = TRACE_SENTINEL;

function tree(id = "a"): Pane {
  const links: Links = {
    [`${id}0`]: { left: `${id}1`, right: `${id}2` },
    [`${id}1`]: {},
    [`${id}2`]: {},
  };
  const model: GraphModel = {
    kind: "binary-tree",
    directed: true,
    nodes: [
      { id: `${id}0`, label: "4", role: "root" },
      { id: `${id}1`, label: "2", role: "normal" },
      { id: `${id}2`, label: "7", role: "normal" },
    ],
    edges: [],
    ranks: [],
    links,
  };
  return { id, title: "root", model };
}

function list(id = "a"): Pane {
  const model: GraphModel = {
    kind: "linked-list",
    directed: true,
    nodes: [
      { id: `${id}0`, label: "1", role: "root" },
      { id: `${id}1`, label: "2", role: "normal" },
      { id: `${id}2`, label: "3", role: "normal" },
    ],
    edges: [],
    ranks: [],
    links: { [`${id}0`]: { next: `${id}1` }, [`${id}1`]: { next: `${id}2` }, [`${id}2`]: {} },
    listGroups: [[`${id}0`, `${id}1`, `${id}2`]],
  };
  return { id, title: "head", model };
}

const grid: Pane = {
  id: "b",
  title: "grid",
  model: {
    kind: "matrix",
    directed: false,
    nodes: [],
    edges: [],
    ranks: [],
    matrix: { showIndices: true, rows: [[{ text: "1", filled: true }, { text: "0", filled: false }]] },
  },
};

const auto = (...steps: string[]) => `${S}0 ${steps.join(" ")}`;

describe("parseAutoLine", () => {
  it("parses every op form with implicit pane a and the pointer name table", () => {
    expect(parseAutoLine(auto("0,b3,2.1,b0.1", "+tz0=5,+lz1=a=b", "@node=0,@node=b1,@=2.1,@node=-,@1=0", "&+1,&-b2", "!3,^z0,^-", "1=x<y,0<1,0>-,b2>z0"))).toEqual([
      [{ t: "visit", ref: "a0" }, { t: "visit", ref: "b3" }, { t: "visit", ref: "a2.1" }, { t: "visit", ref: "b0.1" }],
      [{ t: "alloc", kind: "tree", ref: "z0", label: "5" }, { t: "alloc", kind: "list", ref: "z1", label: "a=b" }],
      [
        { t: "pointer", name: "node", to: "a0" },
        { t: "pointer", name: "node", to: "b1" },
        { t: "pointer", name: null, to: "a2.1" },
        { t: "pointer", name: "node", to: null },
      ],
      [{ t: "front", add: true, ref: "a1" }, { t: "front", add: false, ref: "b2" }],
      [{ t: "del", ref: "a3" }, { t: "result", ref: "z0" }, { t: "result", ref: null }],
      [
        { t: "value", ref: "a1", label: "x<y" },
        { t: "link", ref: "a0", side: "<", to: "a1" },
        { t: "link", ref: "a0", side: ">", to: null },
        { t: "link", ref: "b2", side: ">", to: "z0" },
      ],
    ]);
  });

  it("stops at the truncation marker", () => {
    expect(parseAutoLine(auto("0", "~", "1"))).toEqual([[{ t: "visit", ref: "a0" }], "~"]);
  });
});

describe("buildTrace", () => {
  it("returns no frames for empty text or text without a visible change", () => {
    expect(buildTrace("", [tree()])).toBe(EMPTY_TRACE);
    expect(buildTrace(auto("c9"), [tree()])).toBe(EMPTY_TRACE);
  });

  it("starts from the initial topology and only adds frames for visible changes", () => {
    const trace = buildTrace(auto("@root=0", "0", "0", "@root=0", "@root=1", "1"), [tree()]);
    expect(trace.frames).toHaveLength(5);
    const [first, second, third, fourth, fifth] = trace.frames;
    expect(first).toMatchObject({ visited: [], pointers: {}, dimmed: [] });
    expect(first!.current).toBeUndefined();
    expect(second).toMatchObject({ current: "a0", pointers: { root: "a0" } });
    expect(third!.visited).toEqual(["a0"]);
    expect(fourth).toMatchObject({ current: "a1", pointers: { root: "a1" } });
    expect(fifth!.visited).toEqual(["a0", "a1"]);
    expect(fifth!.layoutKey).toBe(first!.layoutKey);
    expect(fifth!.topology).toBe(first!.topology);
    expect(third!.pointers).toBe(second!.pointers);
  });

  it("sets current to the last pointer that moved in the step", () => {
    const trace = buildTrace(auto("@p=1,@q=2", "@p=-"), [tree()]);
    expect(trace.frames[1]).toMatchObject({ current: "a2", pointers: { p: "a1", q: "a2" } });
    expect(trace.frames[2]).toMatchObject({ current: "a2", pointers: { q: "a2" } });
  });

  it("applies value writes as label overrides without changing the layout", () => {
    const trace = buildTrace(auto("1=7,2=2"), [tree()]);
    const last = trace.frames.at(-1)!;
    expect(last.labels).toEqual({ a1: "7", a2: "2" });
    expect(last.layoutKey).toBe(trace.frames[0]!.layoutKey);
  });

  it("applies links, allocations and deletions to the topology", () => {
    const trace = buildTrace(auto("+tz0=5", "1<z0", "0<-,!1"), [tree()]);
    const [, alloc, link, cut] = trace.frames;
    expect(alloc!.topology.nodes.z0).toEqual({ id: "z0", kind: "tree", label: "5", root: false });
    expect(alloc!.layoutKey).not.toBe(trace.frames[0]!.layoutKey);
    expect(link!.topology.links.a1).toEqual({ left: "z0" });
    expect(cut!.topology.links.a0).toEqual({ right: "a2" });
    expect([...cut!.topology.deleted]).toEqual(["a1"]);
    expect(trace.frames[0]!.topology.links.a0).toEqual({ left: "a1", right: "a2" });
  });

  it("revives a deleted node when it is linked again", () => {
    const trace = buildTrace(auto("0<-,!1", "2<1"), [tree()]);
    expect(trace.frames[1]!.topology.deleted.has("a1")).toBe(true);
    expect(trace.frames[2]!.topology.deleted.size).toBe(0);
    expect(trace.frames[2]!.topology.links.a2).toEqual({ left: "a1" });
  });

  it("uses > as next for list nodes and ignores <", () => {
    const trace = buildTrace(auto("1>0", "2<0"), [list()]);
    expect(trace.frames).toHaveLength(2);
    expect(trace.frames[1]!.topology.links.a1).toEqual({ next: "a0" });
  });

  it("dims nodes the returned node cannot reach", () => {
    expect(buildTrace(auto("^2"), [tree()]).frames[1]).toMatchObject({ current: "a2", dimmed: ["a0", "a1"] });
    expect(buildTrace(auto("^-"), [tree()]).frames[1]!.dimmed).toEqual(["a0", "a1", "a2"]);
  });

  it("tracks frontier additions and removals", () => {
    const trace = buildTrace(auto("&+1,&+2", "&-1"), [tree()]);
    expect(trace.frames[1]!.frontier).toEqual(["a1", "a2"]);
    expect(trace.frames[2]!.frontier).toEqual(["a2"]);
  });

  it("uses grid cells for anonymous pointers and visits", () => {
    const trace = buildTrace(`${S}0 @=b0.0 b0.0 @=b0.1 b0.5`, [grid]);
    expect(trace.frames.map((frame) => frame.current)).toEqual([undefined, "b0.0", "b0.0", "b0.1"]);
    expect(trace.frames.at(-1)!.visited).toEqual(["b0.0"]);
  });

  it("ignores refs into panes that were not built", () => {
    expect(buildTrace(auto("b0", "@p=b1"), [tree()])).toBe(EMPTY_TRACE);
  });

  it("marks truncation and caps frames", () => {
    expect(buildTrace(auto("0", "~"), [tree()]).truncated).toBe(true);
    const many = Array.from({ length: MAX_TRACE_FRAMES + 10 }, (_, i) => `@p=${i % 3}`);
    const trace = buildTrace(auto(...many), [tree()]);
    expect(trace.frames).toHaveLength(MAX_TRACE_FRAMES);
    expect(trace.truncated).toBe(true);
  });

  it("uses only the auto line when one is present, even after text on the same line", () => {
    const trace = buildTrace(`#graphy visit 2\ndone${auto("1")}`, [tree()]);
    expect(trace.frames.at(-1)!.visited).toEqual(["a1"]);
  });

  it("reads manual verbs with labels, ids and legacy refs", () => {
    const trace = buildTrace(["#graphy current 4", "#graphy visit a1 n2", "#graphy walk 7", "#graphy enqueue 2", "#graphy clear"].join("\n"), [tree()]);
    expect(trace.frames.map((frame) => [frame.current, frame.visited.join(",")])).toEqual([
      [undefined, ""],
      ["a0", ""],
      ["a0", "a1"],
      ["a0", "a1,a2"],
      ["a2", "a1,a2"],
      ["a2", "a1,a2"],
      [undefined, ""],
    ]);
    expect(trace.frames[5]!.frontier).toEqual(["a1"]);
    expect(trace.frames[6]!.frontier).toEqual([]);
  });

  it("resolves manual cell refs to the first grid pane", () => {
    const trace = buildTrace("#graphy visit 0,1", [tree(), grid]);
    expect(trace.frames.at(-1)!.visited).toEqual(["b0.1"]);
  });
});
