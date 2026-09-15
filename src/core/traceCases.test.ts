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
  return framesFromStdout(stdout, tree).at(-1)?.links;
}

describe("stdoutForCase", () => {
  it("does not leak case 2 topology into case 1 frames from concatenated stdout", () => {
    const joined = `${case1Stdout}\n#graphy /\n${case2Stdout}`;
    expect(lastLinks(stdoutForCase({ stdout: joined }, 0))?.n0).toEqual({
      left: "n1",
      right: "n2",
    });
    expect(lastLinks(stdoutForCase({ stdout: joined }, 1))?.n0).toEqual({ left: "n2" });
  });

  it("maps std_output_list of two cases to the selected case only", () => {
    const body = { std_output_list: [case1Stdout, case2Stdout] };
    const snapshot = {
      stdout: extractRunStdout(body),
      stdoutByCase: extractRunStdoutByCase(body),
    };
    expect(lastLinks(stdoutForCase(snapshot, 0))?.n0).toEqual({ left: "n1", right: "n2" });
    expect(lastLinks(stdoutForCase(snapshot, 1))?.n0).toEqual({ left: "n2" });
  });
});

describe("splitStdoutByCase", () => {
  it("scopes compact one-line-per-case emit so case 2 topology does not leak", () => {
    const joined = [
      "#g / c n0 v n0 t n0:n1,n2 n1:-,- n2:-,-",
      "#g / c n0 v n0 t n0:n2,- n2:-,-",
    ].join("\n");

    expect(splitStdoutByCase(joined)).toHaveLength(2);
    expect(lastLinks(stdoutForCase({ stdout: joined }, 0))?.n0).toEqual({
      left: "n1",
      right: "n2",
    });
    expect(lastLinks(stdoutForCase({ stdout: joined }, 1))?.n0).toEqual({ left: "n2" });
  });
});
