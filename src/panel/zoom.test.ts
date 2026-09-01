import { describe, expect, it } from "vitest";
import { normalizeWheelDelta, zoomAtPoint } from "./zoom.js";

describe("graph zoom", () => {
  it("makes a 100px wheel gesture substantially faster", () => {
    const next = zoomAtPoint(
      { x: 0, y: 0, scale: 1 },
      { x: 100, y: 50 },
      normalizeWheelDelta(-100, 0, 800),
    );

    expect(next.scale).toBeGreaterThanOrEqual(1.45);
  });

  it("normalizes line wheel deltas to pixels", () => {
    expect(normalizeWheelDelta(3, 1, 800)).toBe(48);
    expect(normalizeWheelDelta(1, 2, 800)).toBe(800);
  });

  it("keeps the graph point under the cursor fixed", () => {
    const previous = { x: 20, y: -10, scale: 1 };
    const cursor = { x: 200, y: 100 };
    const next = zoomAtPoint(previous, cursor, -Math.log(2) / 0.004);

    expect(next).toEqual({ x: -160, y: -120, scale: 2 });
  });

  it("clamps to the maximum scale while preserving the cursor anchor", () => {
    const next = zoomAtPoint({ x: 0, y: 0, scale: 5 }, { x: 100, y: 50 }, -1_000);

    expect(next).toEqual({ x: -20, y: -10, scale: 6 });
  });

  it("clamps to the minimum scale while preserving the cursor anchor", () => {
    const next = zoomAtPoint({ x: 0, y: 0, scale: 0.2 }, { x: 100, y: 50 }, 1_000);

    expect(next.scale).toBe(0.15);
    expect(next.x).toBeCloseTo(25);
    expect(next.y).toBeCloseTo(12.5);
  });
});
