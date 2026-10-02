import { Window } from "happy-dom";
import { describe, expect, it, vi } from "vitest";

import {
  MIN_PANEL_HEIGHT,
  MIN_PANEL_WIDTH,
  TITLEBAR_PX,
  applyShellStyles,
  clampPanelBox,
  createStyleWriter,
} from "./shellLayout.js";

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

describe("createStyleWriter", () => {
  it("writes each property only when its value changes", () => {
    const el = new Window().document.createElement("div") as unknown as HTMLElement;
    const setProperty = vi.spyOn(el.style, "setProperty");
    const write = createStyleWriter();

    write(el, { left: "10px", top: "20px" });
    write(el, { left: "10px", top: "20px" });
    write(el, { left: "12px", top: "20px" });

    expect(setProperty.mock.calls.map(([prop, value]) => [prop, value])).toEqual([
      ["left", "10px"],
      ["top", "20px"],
      ["left", "12px"],
    ]);
    expect(el.style.left).toBe("12px");
  });
});

describe("applyShellStyles", () => {
  it("collapses a settled shrunk shell to the title bar while the iframe keeps its size", () => {
    const document = new Window().document;
    const shell = document.createElement("div") as unknown as HTMLElement;
    const frame = document.createElement("iframe") as unknown as HTMLElement;

    applyShellStyles(shell, frame, { x: 4, y: 8, width: 460, height: 520, open: true, shrunk: true }, { settle: true });

    expect(shell.dataset.open).toBe("true");
    expect(shell.style.height).toBe(`${TITLEBAR_PX}px`);
    expect(shell.style.left).toBe("4px");
    expect(frame.style.height).toBe("520px");
  });

  it("leaves the clip path alone when asked to", () => {
    const document = new Window().document;
    const shell = document.createElement("div") as unknown as HTMLElement;
    const frame = document.createElement("iframe") as unknown as HTMLElement;
    shell.style.setProperty("clip-path", "inset(1px)");

    applyShellStyles(shell, frame, { x: 0, y: 0, width: 460, height: 520, open: true, shrunk: false }, { clipPath: false });

    expect(shell.style.getPropertyValue("clip-path")).toBe("inset(1px)");
  });
});
