import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

import { framesFromStdout, parseTrace } from "../core/trace.js";
import { emptyModel, type GraphModel } from "../core/types.js";
import { PYTHON_GRAPH_TRACE } from "./graphTrace.js";

const grid: GraphModel = {
  ...emptyModel("matrix", "grid"),
  directed: false,
  matrix: {
    showIndices: true,
    rows: [
      [
        { text: "1", filled: true },
        { text: "1", filled: true },
      ],
      [
        { text: "0", filled: false },
        { text: "1", filled: true },
      ],
    ],
  },
};

const PRELUDE = `grid = None
buf = []
last_cell = None
`;

function runPy(src: string): string {
  return execFileSync("python3", ["-c", src], { encoding: "utf8" });
}

describe("compact graph cell parser", () => {
  it("turns (r,c) 2-tuples into cell current+visit events", () => {
    const events = parseTrace("#graphy/[(0,0),(0,1),(1,1)]");
    expect(events.filter((e) => e.kind === "current").map((e) => e.kind === "current" && e.ref)).toEqual([
      "0,0",
      "0,1",
      "1,1",
    ]);
    expect(events.some((e) => e.kind === "topology")).toBe(false);
  });

  it("does not treat (0,2,1) as a cell", () => {
    const events = parseTrace("#graphy/[0,(0,2,1),2]");
    expect(events.filter((e) => e.kind === "topology")).toHaveLength(1);
    expect(events.filter((e) => e.kind === "current").map((e) => (e.kind === "current" ? e.ref : ""))).toEqual([
      "n0",
      "n2",
    ]);
  });
});

describe("python graph helpers (standalone)", () => {
  it("classifies grids and formats 2-tuples without a trailing None", () => {
    const stdout = runPy(`
${PRELUDE}
${PYTHON_GRAPH_TRACE}
assert is_grid([[1, 0], [0, 1]])
assert is_grid(["11", "01"])
assert not is_grid([1, 2, 3])
assert fmt((0, 1)) == "(0,1)"
assert fmt((0, 2, 1)) == "(0,2,1)"
assert fmt((2, None, 5)) == "(2,None,5)"
grid = [["1", "1"], ["0", "1"]]
assert pick_cell({"i": 0, "j": 1}) == (0, 1)
assert pick_cell({"i": 9, "j": 0}) is None
emit_cell(0, 0)
emit_cell(0, 0)
assert buf == [(0, 0)]
print("ok")
`).trim();
    expect(stdout).toBe("ok");
  });

  it("emits #graphy/[(r,c),…] 2-tuples from a grid DFS walk", () => {
    const stdout = runPy(`
${PRELUDE}
${PYTHON_GRAPH_TRACE}

class Solution:
    def numIslands(self, grid):
        rows, cols = len(grid), len(grid[0])
        def dfs(i, j):
            if i < 0 or j < 0 or i >= rows or j >= cols or grid[i][j] != "1":
                return
            grid[i][j] = "0"
            dfs(i + 1, j)
            dfs(i - 1, j)
            dfs(i, j + 1)
            dfs(i, j - 1)
        for i in range(rows):
            for j in range(cols):
                if grid[i][j] == "1":
                    dfs(i, j)
        return 0

def wrap(fn):
    def __graphy_wrapped(*args, **kwargs):
        global grid, last_cell
        last_cell = None
        del buf[:]
        for item in args:
            if is_grid(item):
                grid = item
                break
        import sys
        def tracer(frame, event, arg):
            if event != "line":
                return tracer
            if frame.f_code.co_name.startswith("__graphy"):
                return tracer
            cell = pick_cell(frame.f_locals)
            if cell:
                emit_cell(*cell)
            return tracer
        sys.settrace(tracer)
        try:
            return fn(*args, **kwargs)
        finally:
            sys.settrace(None)
            print("#graphy/[" + ",".join(fmt(item) for item in buf) + "]")
    return __graphy_wrapped

Solution.numIslands = wrap(Solution.numIslands)
Solution().numIslands([["1","1"],["0","1"]])
`);
    const graphyLines = stdout.split(/\r?\n/).filter((line) => /#graphy\//.test(line));
    expect(graphyLines.length).toBeGreaterThan(0);
    expect(graphyLines[0]).toMatch(/^#graphy\/\[/);
    expect(graphyLines[0]).toMatch(/\(\d+,\d+\)/);
    expect(graphyLines[0]).not.toMatch(/\(\d+,\d+,None\)/);

    const events = parseTrace(stdout);
    expect(events.some((e) => e.kind === "current" && e.ref === "0,0")).toBe(true);
    const frames = framesFromStdout(stdout, grid);
    expect(frames.some((frame) => frame.current === "cell:0,0")).toBe(true);
  });
});
