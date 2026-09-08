import { describe, expect, it } from "vitest";

import { extractRunStdout, extractRunStdoutByCase } from "../main-world/runResult.js";
import { emptyModel, type GraphModel } from "./types.js";
import { framesFromStdout } from "./trace.js";
import { splitStdoutByCase, stdoutForCase } from "./traceCases.js";

const tree: GraphModel = {
  ...emptyModel("binary-tree", "root"),
  nodes: [
    { id: "n0", label: "4", role: "root" },
    { id: "n1", label: "2", role: "normal" },
    { id: "n2", label: "7", role: "normal" },
  ],
  links: {
    n0: { left: "n1", right: "n2" },
    n1: {},
    n2: {},
  },
};

const case1Stdout = ["#graphy current n0", "#graphy topology n0:n1,n2 n1:-,- n2:-,-"].join("\n");
const case2Stdout = ["#graphy current n0", "#graphy topology n0:n2,- n2:-,-"].join("\n");

function lastLinks(stdout: string): GraphModel["links"] {
  const frames = framesFromStdout(stdout, tree);
  return frames.at(-1)?.links;
}

describe("stdoutForCase", () => {
  it("does not leak case 2 topology into case 1 frames from concatenated stdout", () => {
    const joined = `${case1Stdout}\n#graphy /\n${case2Stdout}`;
    const scoped = stdoutForCase({ stdout: joined }, 0);
    const frames = framesFromStdout(scoped, tree);

    expect(frames.length).toBeGreaterThan(0);
    expect(frames.some((frame) => frame.links.n0?.left === "n2" && !frame.links.n0?.right)).toBe(
      false,
    );
    expect(frames.at(-1)?.links.n0).toEqual({ left: "n1", right: "n2" });
    expect(lastLinks(stdoutForCase({ stdout: joined }, 1))?.n0).toEqual({ left: "n2" });
  });

  it("maps std_output_list of two cases to the selected case only", () => {
    const body = { std_output_list: [case1Stdout, case2Stdout] };
    const snapshot = {
      stdout: extractRunStdout(body),
      stdoutByCase: extractRunStdoutByCase(body),
    };

    const frames0 = framesFromStdout(stdoutForCase(snapshot, 0), tree);
    const frames1 = framesFromStdout(stdoutForCase(snapshot, 1), tree);

    expect(frames0.at(-1)?.links.n0).toEqual({ left: "n1", right: "n2" });
    expect(frames1.at(-1)?.links.n0).toEqual({ left: "n2" });
    expect(frames0.some((frame) => frame.links.n0?.left === "n2" && !frame.links.n0?.right)).toBe(
      false,
    );
  });

  it("prefers stdoutByCase over a joined blob that includes later cases", () => {
    const scoped = stdoutForCase(
      { stdout: `${case1Stdout}\n${case2Stdout}`, stdoutByCase: [case1Stdout, case2Stdout] },
      0,
    );
    expect(lastLinks(scoped)?.n0).toEqual({ left: "n1", right: "n2" });
  });

  it("returns empty stdout for a case with no segment so playback stops", () => {
    expect(stdoutForCase({ stdout: case1Stdout }, 1)).toBe("");
    expect(framesFromStdout(stdoutForCase({ stdoutByCase: [case1Stdout] }, 1), tree)).toEqual([]);
  });

  it("does not treat #graphy clear as a case boundary", () => {
    const midClear = ["#graphy current n0", "#graphy clear", "#graphy current n1"].join("\n");
    expect(splitStdoutByCase(midClear)).toEqual([midClear]);
    expect(stdoutForCase({ stdout: midClear }, 0)).toBe(midClear);
  });
});

describe("splitStdoutByCase", () => {
  it("splits on #g / including packed remainder on the same line", () => {
    const compact = "#g / c n0\n#g v n0\n#g / c n1\n#g v n1";
    expect(splitStdoutByCase(compact)).toEqual(["#g c n0\n#g v n0", "#g c n1\n#g v n1"]);
  });

  it("scopes the compact one-line-per-case emit so case 2 topology does not leak", () => {
    const case1 = "#g / c n0 v n0 t n0:n1,n2 n1:-,- n2:-,-";
    const case2 = "#g / c n0 v n0 t n0:n2,- n2:-,-";
    const joined = `${case1}\n${case2}`;

    expect(splitStdoutByCase(joined)).toEqual([
      "#g c n0 v n0 t n0:n1,n2 n1:-,- n2:-,-",
      "#g c n0 v n0 t n0:n2,- n2:-,-",
    ]);
    expect(lastLinks(stdoutForCase({ stdout: joined }, 0))?.n0).toEqual({
      left: "n1",
      right: "n2",
    });
    expect(lastLinks(stdoutForCase({ stdout: joined }, 1))?.n0).toEqual({ left: "n2" });
  });

  it("splits #graphy/[array] lines and keeps case 2 deltas off case 1", () => {
    const case1 = "#graphy/[0,(0,1,2)]";
    const case2 = "#graphy/[0,(0,2,-)]";
    const joined = `${case1}\n${case2}`;

    expect(splitStdoutByCase(joined)).toEqual(["#graphy [0,(0,1,2)]", "#graphy [0,(0,2,-)]"]);
    expect(lastLinks(stdoutForCase({ stdout: joined }, 0))?.n0).toEqual({
      left: "n1",
      right: "n2",
    });
    expect(lastLinks(stdoutForCase({ stdout: joined }, 1))?.n0).toEqual({ left: "n2" });
  });

  it("keeps a blob without case-break markers as a single segment", () => {
    expect(splitStdoutByCase(case1Stdout)).toEqual([case1Stdout]);
  });
});
