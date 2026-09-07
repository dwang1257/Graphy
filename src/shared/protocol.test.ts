import { describe, expect, it } from "vitest";

import { PAGE_CHANNEL, PANEL_CHANNEL, isPageMessage, isToPanel } from "./protocol.js";

const validSnapshot = {
  cases: ["[1,2,3]\n2", "[9,8,7]\n8"],
  code: "class Solution {}",
  lang: "cpp",
  slug: "two-sum",
  source: "editor" as const,
  at: 1,
};

describe("snapshot validation", () => {
  it("accepts a multi-case snapshot", () => {
    expect(
      isPageMessage({ channel: PAGE_CHANNEL, type: "snapshot", payload: validSnapshot }),
    ).toBe(true);
  });

  it("accepts an optional captureError", () => {
    expect(
      isToPanel({
        channel: PANEL_CHANNEL,
        type: "snapshot",
        payload: { ...validSnapshot, cases: [], captureError: "Could not separate test cases." },
      }),
    ).toBe(true);
  });

  it("accepts optional Run stdout", () => {
    expect(
      isPageMessage({
        channel: PAGE_CHANNEL,
        type: "snapshot",
        payload: { ...validSnapshot, source: "network", stdout: "#graphy current n0\n" },
      }),
    ).toBe(true);
  });

  it("rejects non-string stdout", () => {
    expect(
      isPageMessage({
        channel: PAGE_CHANNEL,
        type: "snapshot",
        payload: { ...validSnapshot, stdout: ["#graphy current n0"] },
      }),
    ).toBe(false);
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

  it("rejects non-string case entries", () => {
    expect(
      isPageMessage({
        channel: PAGE_CHANNEL,
        type: "snapshot",
        payload: { ...validSnapshot, cases: [["1", "2"]] },
      }),
    ).toBe(false);
  });
});
