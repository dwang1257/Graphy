import { describe, expect, it } from "vitest";

import { DEFAULT_PANEL, sanitizePanelState } from "./storage.js";

describe("sanitizePanelState", () => {
  it("keeps a complete valid payload", () => {
    const stored = { x: 10, y: 20, width: 400, height: 300, open: true, shrunk: true };
    expect(sanitizePanelState(stored)).toEqual(stored);
  });

  it("rejects non-boolean shrunk/open and non-finite geometry", () => {
    expect(
      sanitizePanelState({
        x: "10",
        y: Number.NaN,
        width: "wide",
        height: Number.POSITIVE_INFINITY,
        open: 1,
        shrunk: "true",
      }),
    ).toEqual(DEFAULT_PANEL);
  });

  it("fills missing keys from defaults", () => {
    expect(sanitizePanelState({})).toEqual(DEFAULT_PANEL);
    expect(sanitizePanelState(null)).toEqual(DEFAULT_PANEL);
  });
});
