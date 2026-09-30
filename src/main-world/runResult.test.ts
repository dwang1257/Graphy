import { describe, expect, it } from "vitest";

import { MAX_STDOUT_CASES, MAX_STDOUT_LENGTH } from "../shared/protocol.js";
import { extractRunStdout, extractRunStdoutByCase } from "./runResult.js";

describe("run stdout extraction", () => {
  it("rejects oversized stdout strings", () => {
    expect(extractRunStdout({ std_output: "x".repeat(MAX_STDOUT_LENGTH + 1) })).toBeUndefined();
  });

  it("rejects oversized stdout case arrays", () => {
    expect(extractRunStdoutByCase({
      std_output_list: Array.from({ length: MAX_STDOUT_CASES + 1 }, () => "ok"),
    })).toBeUndefined();
  });

  it("rejects non-string stdout entries", () => {
    expect(extractRunStdoutByCase({ std_output_list: ["ok", 1] })).toBeUndefined();
  });
});
