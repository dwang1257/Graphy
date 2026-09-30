import { describe, expect, it } from "vitest";

import { PYTHON_SENTINEL, stripCheckBody, TRACE_SENTINEL, traceLines } from "./traceWire.js";

const S = TRACE_SENTINEL;

describe("trace sentinel", () => {
  it("is a private-use character with an ASCII Python escape", () => {
    expect(S).toBe("\u{E000}");
    expect(PYTHON_SENTINEL).toBe("\\ue000");
  });
});

describe("traceLines", () => {
  it("returns each trace from the sentinel to the end of its line", () => {
    expect(traceLines(`user\n${S}0 1\r\ndone${S}1 2\nplain`)).toEqual([`${S}0 1`, `${S}1 2`]);
    expect(traceLines("plain")).toEqual([]);
  });
});

describe("stripCheckBody", () => {
  it("returns null when nothing changes", () => {
    expect(stripCheckBody({ state: "SUCCESS", code_output: ["a"], std_output_list: ["x"], std_output: "y" })).toBeNull();
    expect(stripCheckBody({ state: "SUCCESS" })).toBeNull();
  });

  it("drops trace entries from code_output arrays and strips the other fields", () => {
    const body = {
      state: "SUCCESS",
      code_output: ["one", `${S}0 1`, "", `${S}1 2`],
      std_output_list: [`one\n${S}0 1\n`, `${S}1 2\n`, "plain"],
      std_output: `one\n${S}0 1\n`,
      expected_output: `${S}untouched`,
    };
    expect(stripCheckBody(body)).toEqual({
      state: "SUCCESS",
      code_output: ["one", ""],
      std_output_list: ["one\n", "", "plain"],
      std_output: "one\n",
      expected_output: `${S}untouched`,
    });
    expect(body.code_output).toHaveLength(4);
  });

  it("keeps user text printed before the trace on the same line", () => {
    expect(stripCheckBody({
      code_output: [`done${S}0 1`],
      std_output_list: [`a\ndone${S}0 1\n`],
      std_output: `done${S}0 1\nafter`,
    })).toEqual({ code_output: ["done"], std_output_list: ["a\ndone"], std_output: "doneafter" });
  });
});
