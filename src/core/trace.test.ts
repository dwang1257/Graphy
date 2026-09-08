import { describe, expect, it } from "vitest";

import { emptyModel, type GraphModel } from "./types.js";
import { parseTrace, resolveRef, framesFromStdout } from "./trace.js";

describe("parseTrace", () => {
  it("ignores non-graphy lines", () => {
    expect(parseTrace("hello\nworld\n")).toEqual([]);
  });

  it("parses #graphy current / visit / enqueue / dequeue", () => {
    const events = parseTrace(
      ["print noise", "#graphy current n0", "#graphy visit n0", "#graphy enqueue n1", "#graphy dequeue n1"].join(
        "\n",
      ),
    );
    expect(events).toEqual([
      { kind: "current", ref: "n0", line: 2 },
      { kind: "visit", ref: "n0", line: 3 },
      { kind: "enqueue", ref: "n1", line: 4 },
      { kind: "dequeue", ref: "n1", line: 5 },
    ]);
  });

  it("accepts graphy without hash and curr alias", () => {
    expect(parseTrace("graphy curr 3\nGRAPHY VISIT @1\n")).toEqual([
      { kind: "current", ref: "3", line: 1 },
      { kind: "visit", ref: "@1", line: 2 },
    ]);
  });

  it("parses frontier replacement and clear", () => {
    expect(parseTrace("#graphy frontier n1 n2\n#graphy clear\n")).toEqual([
      { kind: "frontier", refs: ["n1", "n2"], line: 1 },
      { kind: "clear", line: 2 },
    ]);
  });

  it("parses several commands packed onto one line", () => {
    expect(parseTrace("#graphy current n0 visit n0 current n1 visit n1")).toEqual([
      { kind: "current", ref: "n0", line: 1 },
      { kind: "visit", ref: "n0", line: 1 },
      { kind: "current", ref: "n1", line: 1 },
      { kind: "visit", ref: "n1", line: 1 },
    ]);
  });

  it("expands a walk list into current then visit per node", () => {
    expect(parseTrace("#graphy walk n0 n2 n1")).toEqual([
      { kind: "current", ref: "n0", line: 1 },
      { kind: "visit", ref: "n0", line: 1 },
      { kind: "current", ref: "n2", line: 1 },
      { kind: "visit", ref: "n2", line: 1 },
      { kind: "current", ref: "n1", line: 1 },
      { kind: "visit", ref: "n1", line: 1 },
    ]);
  });

  it("parses topology snapshots", () => {
    expect(parseTrace("#graphy topology n0:n2,n1 n1:-,- n2:n6,n5")).toEqual([
      {
        kind: "topology",
        links: {
          n0: { left: "n2", right: "n1" },
          n1: {},
          n2: { left: "n6", right: "n5" },
        },
        line: 1,
      },
    ]);
  });

  it("parses compact #g / c / v / t aliases on one packed line", () => {
    expect(parseTrace("#g / c n0 v n0 t n0:n2,n1 n2:n5,n6")).toEqual([
      { kind: "clear", line: 1 },
      { kind: "current", ref: "n0", line: 1 },
      { kind: "visit", ref: "n0", line: 1 },
      {
        kind: "topology",
        links: {
          n0: { left: "n2", right: "n1" },
          n2: { left: "n5", right: "n6" },
        },
        line: 1,
      },
    ]);
  });

  it("accepts #g and g prefixes with single-letter verbs", () => {
    expect(parseTrace("#g c n0\ng v n1\n#G t n0:n1,-\n")).toEqual([
      { kind: "current", ref: "n0", line: 1 },
      { kind: "visit", ref: "n1", line: 2 },
      { kind: "topology", links: { n0: { left: "n1" } }, line: 3 },
    ]);
  });

  it("treats #g / as a case-break clear and does not treat c as walk", () => {
    expect(parseTrace("#g /\n#g c n0")).toEqual([
      { kind: "clear", line: 1 },
      { kind: "current", ref: "n0", line: 2 },
    ]);
  });

  it("parses a compact #graphy/ array of visits and topology tuples", () => {
    expect(parseTrace("#graphy/[0,(0,2,1),2,(2,None,5)]")).toEqual([
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
      {
        kind: "topology",
        links: { n2: { right: "n5" } },
        line: 1,
        patch: true,
      },
    ]);
  });
});


describe("resolveRef", () => {
  const tree: GraphModel = {
    ...emptyModel("binary-tree", "root"),
    nodes: [
      { id: "n0", label: "3", role: "root" },
      { id: "n1", label: "9", role: "normal" },
      { id: "n2", label: "20", role: "normal" },
      { id: "s_n0", label: "", role: "spine" },
    ],
  };

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

  it("keeps explicit node ids", () => {
    expect(resolveRef("n1", tree)).toBe("n1");
  });

  it("maps @index to n{index}", () => {
    expect(resolveRef("@2", tree)).toBe("n2");
  });

  it("maps bare values to the first visible node with that label", () => {
    expect(resolveRef("20", tree)).toBe("n2");
  });

  it("skips spine nodes when matching by label", () => {
    expect(resolveRef("", tree)).toBeUndefined();
  });

  it("maps row,col to cell keys on matrices", () => {
    expect(resolveRef("1,0", grid)).toBe("cell:1,0");
    expect(resolveRef("@1,0", grid)).toBe("cell:1,0");
  });
});

describe("framesFromStdout", () => {
  const list: GraphModel = {
    ...emptyModel("linked-list", "head"),
    nodes: [
      { id: "n0", label: "1", role: "root" },
      { id: "n1", label: "2", role: "normal" },
      { id: "n2", label: "3", role: "normal" },
    ],
  };

  it("builds cumulative frames for playback", () => {
    const frames = framesFromStdout(
      ["#graphy current 1", "#graphy visit 1", "#graphy enqueue 2", "#graphy current 2", "#graphy visit 2"].join(
        "\n",
      ),
      list,
    );
    expect(frames).toHaveLength(5);
    expect(frames[0]).toMatchObject({ current: "n0", visited: [], frontier: [] });
    expect(frames[1]).toMatchObject({ current: "n0", visited: ["n0"], frontier: [] });
    expect(frames[2]).toMatchObject({ current: "n0", visited: ["n0"], frontier: ["n1"] });
    expect(frames[3]).toMatchObject({ current: "n1", visited: ["n0"], frontier: ["n1"] });
    expect(frames[4]).toMatchObject({ current: "n1", visited: ["n0", "n1"], frontier: ["n1"] });
  });

  it("clears state on clear", () => {
    const frames = framesFromStdout("#graphy visit n0\n#graphy clear\n#graphy current n1\n", list);
    expect(frames[1]).toMatchObject({ current: undefined, visited: [], frontier: [] });
    expect(frames[2]).toMatchObject({ current: "n1", visited: [], frontier: [] });
  });

  it("returns an empty list when stdout has no graphy lines", () => {
    expect(framesFromStdout("Accepted\n", list)).toEqual([]);
  });
});

describe("framesFromStdout topology", () => {
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

  it("seeds links from the model and updates them on topology", () => {
    const frames = framesFromStdout(
      ["#graphy current n0", "#graphy topology n0:n2,n1 n1:n3,- n2:-,- n3:-,-"].join("\n"),
      tree,
    );
    expect(frames[0]).toMatchObject({
      current: "n0",
      links: tree.links,
      deleted: [],
    });
    expect(frames[1]?.links).toEqual({
      n0: { left: "n2", right: "n1" },
      n1: { left: "n3" },
      n2: {},
      n3: {},
    });
    expect(frames[1]?.deleted).toEqual([]);
  });

  it("marks unlinked children as deleted until they reappear", () => {
    const frames = framesFromStdout(
      [
        "#graphy topology n0:n1,n2 n1:-,- n2:-,-",
        "#graphy topology n0:n2,n1 n1:-,- n2:-,-",
      ].join("\n"),
      tree,
    );
    expect(frames[0]?.deleted.sort()).toEqual(["n3"]);
    expect(frames[1]?.deleted.sort()).toEqual(["n3"]);
  });

  it("merges array topology tuples onto the seeded tree", () => {
    const frames = framesFromStdout("#graphy/[0,(0,2,1)]", tree);
    expect(frames.at(-1)?.links).toEqual({
      n0: { left: "n2", right: "n1" },
      n1: { left: "n3" },
      n2: {},
      n3: {},
    });
    expect(frames.at(-1)?.current).toBe("n0");
    expect(frames.at(-1)?.visited).toEqual(["n0"]);
  });
});

