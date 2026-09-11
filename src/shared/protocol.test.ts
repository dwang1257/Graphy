import { describe, expect, it } from "vitest";

import {
  PAGE_CHANNEL,
  PANEL_CHANNEL,
  isPageMessage,
  isPageTraceMessage,
  isPanelMessage,
  isToPanel,
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

  it("accepts optional per-case stdout", () => {
    expect(
      isPageMessage({
        channel: PAGE_CHANNEL,
        type: "snapshot",
        payload: { ...validSnapshot, source: "network", stdoutByCase: ["#g c n0", "#g c n1"] },
      }),
    ).toBe(true);
  });

  it("rejects non-string-array stdoutByCase", () => {
    expect(
      isPageMessage({
        channel: PAGE_CHANNEL,
        type: "snapshot",
        payload: { ...validSnapshot, stdoutByCase: [1, 2] },
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

describe("host chrome messages", () => {
  it("accepts a shrunk state echo from the host", () => {
    expect(isToPanel({ channel: PANEL_CHANNEL, type: "shrunk", shrunk: true })).toBe(true);
    expect(isToPanel({ channel: PANEL_CHANNEL, type: "shrunk", shrunk: false })).toBe(true);
    expect(isToPanel({ channel: PANEL_CHANNEL, type: "shrunk", shrunk: 1 })).toBe(false);
  });

});

describe("setShrunk messages", () => {
  it("accepts an explicit shrink or expand from the panel", () => {
    expect(isPanelMessage({ channel: PANEL_CHANNEL, type: "setShrunk", shrunk: true })).toBe(true);
    expect(isPanelMessage({ channel: PANEL_CHANNEL, type: "setShrunk", shrunk: false })).toBe(true);
  });

  it("rejects a setShrunk payload that is not a boolean", () => {
    expect(isPanelMessage({ channel: PANEL_CHANNEL, type: "setShrunk", shrunk: 1 })).toBe(false);
    expect(isPanelMessage({ channel: PANEL_CHANNEL, type: "setShrunk" })).toBe(false);
  });
});

describe("page trace messages", () => {
  it("accepts an enabled or disabled trace flag", () => {
    expect(isPageTraceMessage({ channel: PAGE_CHANNEL, type: "trace", enabled: true })).toBe(true);
    expect(isPageTraceMessage({ channel: PAGE_CHANNEL, type: "trace", enabled: false })).toBe(true);
    expect(isPageTraceMessage(pageTraceMessage(true))).toBe(true);
  });

  it("rejects a trace flag that is not a boolean", () => {
    expect(isPageTraceMessage({ channel: PAGE_CHANNEL, type: "trace", enabled: 1 })).toBe(false);
    expect(isPageTraceMessage({ channel: PAGE_CHANNEL, type: "trace" })).toBe(false);
    expect(isPageTraceMessage({ channel: PAGE_CHANNEL, type: "snapshot", enabled: true })).toBe(false);
    expect(isPageTraceMessage({ type: "trace", enabled: true })).toBe(false);
  });

  it("does not treat a trace flag as a snapshot", () => {
    expect(isPageMessage({ channel: PAGE_CHANNEL, type: "trace", enabled: true })).toBe(false);
    expect(isPageMessage(pageTraceMessage(false))).toBe(false);
  });
});
