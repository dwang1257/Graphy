import { describe, expect, it } from "vitest";

import { traceTextForCase } from "./traceCases.js";
import { TRACE_SENTINEL } from "./traceWire.js";

const S = TRACE_SENTINEL;

describe("traceTextForCase", () => {
  it("returns nothing without a source", () => {
    expect(traceTextForCase(null, 0)).toBe("");
    expect(traceTextForCase({ stdout: "x" }, -1)).toBe("");
  });

  it("uses the per-case stdout, including a trace printed after text without a newline", () => {
    const source = { stdoutByCase: [`user\n${S}0 1`, `done${S}1 2\n`, "#graphy visit 3"] };
    expect(traceTextForCase(source, 0)).toBe(`${S}0 1`);
    expect(traceTextForCase(source, 1)).toBe(`${S}1 2`);
    expect(traceTextForCase(source, 2)).toBe("#graphy visit 3");
    expect(traceTextForCase(source, 3)).toBe("");
  });

  it("picks the trace by case number from joined stdout", () => {
    const stdout = `print 0\n${S}0 a\nprint 2\n${S}2 c`;
    expect(traceTextForCase({ stdout }, 0)).toBe(`${S}0 a`);
    expect(traceTextForCase({ stdout }, 1)).toBe("");
    expect(traceTextForCase({ stdout }, 2)).toBe(`${S}2 c`);
  });

  it("keeps manual lines for the first case of joined stdout only", () => {
    expect(traceTextForCase({ stdout: "#graphy visit 1" }, 0)).toBe("#graphy visit 1");
    expect(traceTextForCase({ stdout: "#graphy visit 1" }, 1)).toBe("");
  });
});
