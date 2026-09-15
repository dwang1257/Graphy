import { describe, expect, it } from "vitest";

import { parseLinkedList } from "./parse/linkedList.js";
import { emptyModel, type GraphModel } from "./types.js";
import { framesFromStdout, parseTrace } from "./trace.js";

const grid: GraphModel = {
  ...emptyModel("matrix", "grid"),
  directed: false,
  matrix: {
    showIndices: true,
    rows: [
      [
        { text: "1", filled: true },
        { text: "0", filled: false },
      ],
      [
        { text: "0", filled: false },
        { text: "1", filled: true },
      ],
    ],
  },
};

const tree: GraphModel = {
  ...emptyModel("binary-tree", "root"),
  nodes: [
    { id: "n0", label: "4", role: "root" },
    { id: "n1", label: "2", role: "normal" },
    { id: "n2", label: "7", role: "normal" },
    { id: "n3", label: "1", role: "normal" },
  ],
  links: {
    n0: { left: "n1", right: "n2" },
    n1: { left: "n3" },
    n2: {},
    n3: {},
  },
};

describe("parseTrace", () => {
  it("parses compact #graphy/ visits and topology tuples", () => {
    expect(parseTrace("#graphy/[0,(0,2,1),2]")).toEqual([
      { kind: "current", ref: "n0", line: 1 },
      { kind: "visit", ref: "n0", line: 1 },
      {
        kind: "topology",
        links: { n0: { left: "n2", right: "n1" } },
        line: 1,
        patch: true,
      },
      { kind: "current", ref: "n2", line: 1 },
      { kind: "visit", ref: "n2", line: 1 },
    ]);
  });
});

describe("framesFromStdout", () => {
  it("builds cumulative frames for playback", () => {
    const list: GraphModel = {
      ...emptyModel("linked-list", "head"),
      nodes: [
        { id: "n0", label: "1", role: "root" },
        { id: "n1", label: "2", role: "normal" },
        { id: "n2", label: "3", role: "normal" },
      ],
    };
    const frames = framesFromStdout(
      ["#graphy current 1", "#graphy visit 1", "#graphy enqueue 2", "#graphy current 2"].join("\n"),
      list,
    );
    expect(frames[0]).toMatchObject({ current: "n0", visited: [] });
    expect(frames[1]).toMatchObject({ current: "n0", visited: ["n0"] });
    expect(frames[3]).toMatchObject({ current: "n1", visited: ["n0"], frontier: ["n1"] });
  });

  it("maps compact cell 2-tuples onto matrix cell ids", () => {
    const frames = framesFromStdout("#graphy/[(0,1),(1,0)]", grid);
    expect(frames.at(-1)).toMatchObject({
      current: "cell:1,0",
      visited: ["cell:0,1", "cell:1,0"],
    });
  });

  it("updates topology links and marks unlinked children as deleted", () => {
    const frames = framesFromStdout(
      "#graphy topology n0:n1,n2 n1:-,- n2:-,-",
      tree,
    );
    expect(frames[0]?.deleted.sort()).toEqual(["n3"]);
    expect(frames[0]?.links.n0).toEqual({ left: "n1", right: "n2" });
  });

  it("does not mark unlinked list nodes as deleted during reverse", () => {
    const list = parseLinkedList([1, 2, 3], "head");
    const frames = framesFromStdout("#graphy/[(0,None,None)]", list);
    expect(frames.at(-1)?.links.n0).toEqual({});
    expect(frames.at(-1)?.deleted).toEqual([]);
  });

  it("keeps allocated list nodes on frames so a third chain can be drawn", () => {
    const lists = parseLinkedList([2, 4, 3], "l1");
    const frames = framesFromStdout("#graphy/[(6,None,None,0),(7,None,None,7),(6,7,None)]", lists);
    expect(frames.at(-1)?.allocs).toEqual([
      { id: "n6", label: "0", role: "normal" },
      { id: "n7", label: "7", role: "normal" },
    ]);
    expect(frames.at(-1)?.links.n6).toEqual({ left: "n7" });
  });
});
