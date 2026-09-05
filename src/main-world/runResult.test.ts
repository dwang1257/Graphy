import { describe, expect, it } from "vitest";

import { extractRunStdout } from "./runResult.js";

describe("extractRunStdout", () => {
  it("joins code_output string arrays", () => {
    expect(
      extractRunStdout({
        state: "SUCCESS",
        code_output: ["#graphy current n0", "#graphy visit n0"],
      }),
    ).toBe("#graphy current n0\n#graphy visit n0");
  });

  it("accepts a single code_output string", () => {
    expect(extractRunStdout({ code_output: "#graphy curr 1" })).toBe("#graphy curr 1");
  });

  it("falls back to std_output_list then std_output", () => {
    expect(extractRunStdout({ std_output_list: ["a", "b"] })).toBe("a\nb");
    expect(extractRunStdout({ std_output: "solo" })).toBe("solo");
  });

  it("returns undefined when nothing printable is present", () => {
    expect(extractRunStdout({ state: "SUCCESS" })).toBeUndefined();
    expect(extractRunStdout({ code_output: [] })).toBeUndefined();
    expect(extractRunStdout(null)).toBeUndefined();
  });
});
