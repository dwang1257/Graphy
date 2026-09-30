import { describe, expect, it } from "vitest";

import { MIN_PANEL_HEIGHT, MIN_PANEL_WIDTH, TITLEBAR_PX, clampPanelBox } from "./shellLayout.js";

describe("clampPanelBox", () => {
  it("pulls a persisted off-screen origin back so the full panel stays visible", () => {
    const next = clampPanelBox(
      { x: 1840, y: 1040, width: 460, height: 520 },
      { width: 1920, height: 1080 },
    );

    expect(next).toEqual({ x: 1460, y: 560, width: 460, height: 520 });
    expect(next.x + next.width).toBeLessThanOrEqual(1920);
    expect(next.y + next.height).toBeLessThanOrEqual(1080);
  });

  it("keeps the title bar and close controls on screen on a short viewport", () => {
    const next = clampPanelBox(
      { x: 800, y: 700, width: 460, height: 520 },
      { width: 400, height: 300 },
    );

    expect(next.width).toBe(Math.max(MIN_PANEL_WIDTH, 400));
    expect(next.height).toBe(Math.max(MIN_PANEL_HEIGHT, 300));
    expect(next.x).toBe(0);
    expect(next.y).toBe(0);
    expect(next.y + TITLEBAR_PX).toBeLessThanOrEqual(300);
  });
});
