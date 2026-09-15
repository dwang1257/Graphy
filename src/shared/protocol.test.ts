import { describe, expect, it } from "vitest";

import {
  PAGE_CHANNEL,
  isPageMessage,
  isPageTraceMessage,
  pageTraceMessage,
} from "./protocol.js";

const validSnapshot = {
  cases: ["[1,2,3]\n2", "[9,8,7]\n8"],
  code: "class Solution {}",
  lang: "cpp",
  slug: "two-sum",
  source: "editor" as const,
  at: 1,
};

describe("snapshot validation", () => {
  it("accepts a multi-case snapshot with optional stdout", () => {
    expect(
      isPageMessage({ channel: PAGE_CHANNEL, type: "snapshot", payload: validSnapshot }),
    ).toBe(true);
    expect(
      isPageMessage({
        channel: PAGE_CHANNEL,
        type: "snapshot",
        payload: {
          ...validSnapshot,
          source: "network",
          stdout: "#graphy current n0\n",
          stdoutByCase: ["#g c n0", "#g c n1"],
        },
      }),
    ).toBe(true);
  });

  it("rejects snapshots that still use a single input string", () => {
    expect(
      isPageMessage({
        channel: PAGE_CHANNEL,
        type: "snapshot",
        payload: {
          input: "[1,2,3]\n2",
          code: "class Solution {}",
          lang: "cpp",
          slug: "two-sum",
          source: "editor",
          at: 1,
        },
      }),
    ).toBe(false);
  });
});

describe("page trace messages", () => {
  it("accepts a boolean trace flag and does not treat it as a snapshot", () => {
    expect(isPageTraceMessage(pageTraceMessage(true))).toBe(true);
    expect(isPageTraceMessage({ channel: PAGE_CHANNEL, type: "trace", enabled: false })).toBe(true);
    expect(isPageMessage(pageTraceMessage(false))).toBe(false);
  });
});
