import { describe, expect, it } from "vitest";

import {
  MAX_CAPTURE_ERROR_LENGTH,
  MAX_CODE_LENGTH,
  MAX_LANG_LENGTH,
  MAX_PARAM_FIELD_LENGTH,
  MAX_SLUG_LENGTH,
  MAX_SNAPSHOT_CASES,
  MAX_SNAPSHOT_CASE_LENGTH,
  MAX_SNAPSHOT_PARAMS,
  MAX_STDOUT_CASES,
  MAX_STDOUT_LENGTH,
  PAGE_CHANNEL,
  isPageControlMessage,
  isPageMessage,
  isPanelMessage,
  isToPanel,
  pageClearMessage,
  pageHooksMessage,
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

  it("accepts metadata params", () => {
    expect(isPageMessage({
      channel: PAGE_CHANNEL,
      type: "snapshot",
      payload: { ...validSnapshot, params: [{ name: "nums", type: "integer[]" }, { name: "target", type: "integer" }] },
    })).toBe(true);
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

  it.each([
    ["case count", { cases: Array.from({ length: MAX_SNAPSHOT_CASES + 1 }, () => "1") }],
    ["case length", { cases: ["x".repeat(MAX_SNAPSHOT_CASE_LENGTH + 1)] }],
    ["code length", { code: "x".repeat(MAX_CODE_LENGTH + 1) }],
    ["language length", { lang: "x".repeat(MAX_LANG_LENGTH + 1) }],
    ["slug length", { slug: "x".repeat(MAX_SLUG_LENGTH + 1) }],
    ["param count", { params: Array.from({ length: MAX_SNAPSHOT_PARAMS + 1 }, () => ({ name: "a", type: "integer" })) }],
    ["param name length", { params: [{ name: "x".repeat(MAX_PARAM_FIELD_LENGTH + 1), type: "integer" }] }],
    ["param type length", { params: [{ name: "a", type: "x".repeat(MAX_PARAM_FIELD_LENGTH + 1) }] }],
    ["capture error length", { captureError: "x".repeat(MAX_CAPTURE_ERROR_LENGTH + 1) }],
    ["stdout length", { stdout: "x".repeat(MAX_STDOUT_LENGTH + 1) }],
    ["stdout case count", { stdoutByCase: Array.from({ length: MAX_STDOUT_CASES + 1 }, () => "") }],
    ["stdout case length", { stdoutByCase: ["x".repeat(MAX_STDOUT_LENGTH + 1)] }],
  ])("rejects oversized snapshot %s", (_label, patch) => {
    expect(isPageMessage({
      channel: PAGE_CHANNEL,
      type: "snapshot",
      payload: { ...validSnapshot, ...patch },
    })).toBe(false);
    expect(isToPanel({
      channel: "graphy:panel",
      type: "snapshot",
      payload: { ...validSnapshot, ...patch },
    })).toBe(false);
  });

  it("rejects malformed optional snapshot fields", () => {
    expect(isPageMessage({
      channel: PAGE_CHANNEL,
      type: "snapshot",
      payload: { ...validSnapshot, captureError: 1 },
    })).toBe(false);
    expect(isPageMessage({
      channel: PAGE_CHANNEL,
      type: "snapshot",
      payload: { ...validSnapshot, stdoutByCase: ["ok", 1] },
    })).toBe(false);
    for (const params of [{}, [null], [{ name: "a" }], [{ name: "", type: "integer" }], [{ name: "a", type: 1 }]]) {
      expect(isPageMessage({
        channel: PAGE_CHANNEL,
        type: "snapshot",
        payload: { ...validSnapshot, params },
      })).toBe(false);
    }
  });
});

describe("page trace messages", () => {
  it("accepts a boolean trace flag and does not treat it as a snapshot", () => {
    expect(isPageControlMessage(pageTraceMessage(true))).toBe(true);
    expect(isPageControlMessage({ channel: PAGE_CHANNEL, type: "trace", enabled: false })).toBe(true);
    expect(isPageControlMessage({ channel: PAGE_CHANNEL, type: "trace", enabled: "yes" })).toBe(false);
    expect(isPageMessage(pageTraceMessage(false))).toBe(false);
  });
});

describe("page lifecycle messages", () => {
  it("accepts hook activation and deactivation controls", () => {
    expect(isPageControlMessage(pageHooksMessage(true))).toBe(true);
    expect(isPageControlMessage(pageHooksMessage(false))).toBe(true);
    expect(isPageMessage(pageHooksMessage(true))).toBe(false);
  });

  it("accepts clear messages for page and panel state", () => {
    expect(isPageMessage(pageClearMessage())).toBe(true);
    expect(isToPanel({ channel: "graphy:panel", type: "clear" })).toBe(true);
  });
});

describe("panel messages", () => {
  it("accepts every message the panel sends", () => {
    for (const type of ["ready", "close", "persist"]) {
      expect(isPanelMessage({ channel: "graphy:panel", type })).toBe(true);
    }
    expect(isPanelMessage({ channel: "graphy:panel", type: "setShrunk", shrunk: true })).toBe(true);
    expect(isPanelMessage({ channel: "graphy:panel", type: "move", dx: 1, dy: -2 })).toBe(true);
  });

  it("rejects clear, which only flows toward the panel", () => {
    expect(isPanelMessage({ channel: "graphy:panel", type: "clear" })).toBe(false);
  });
});
