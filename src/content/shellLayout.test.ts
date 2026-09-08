/** @vitest-environment happy-dom */

import { describe, expect, it } from "vitest";

import {
  MIN_PANEL_HEIGHT,
  MIN_PANEL_WIDTH,
  RESIZE_HIT_PX,
  SHRINK_MS,
  TITLEBAR_PX,
  applyResizePreview,
  applyShellStyles,
  clampPanelSize,
  clearResizePreview,
  clipAnimation,
  resizeHitHidden,
  resizeHitPosition,
  resizeScale,
  shellClipPath,
  shellGeometry,
  shrinkHitOffset,
  shrinkHitPosition,
} from "./shellLayout.js";

describe("shellGeometry", () => {
  const expanded = { width: 460, height: 520, shrunk: false };

  it("keeps the iframe at the expanded size when the shell is shrunk", () => {
    const full = shellGeometry(expanded);
    const clipped = shellGeometry({ ...expanded, shrunk: true });

    expect(clipped.iframe).toEqual(full.iframe);
    expect(clipped.iframe).toEqual({ width: 460, height: 520 });
  });

  it("clips with clip-path and leaves the shell layout box expanded", () => {
    const clipped = shellGeometry({ width: 460, height: 520, shrunk: true });

    expect(clipped.shell).toEqual({ width: 460, height: 520 });
    expect(clipped.clipPath).toBe(`inset(0px 0px ${520 - TITLEBAR_PX}px 0px)`);
  });

  it("settles the layout box to the title bar after the clip animation", () => {
    const settled = shellGeometry({ width: 460, height: 520, shrunk: true }, true);

    expect(settled.shell).toEqual({ width: 460, height: TITLEBAR_PX });
    expect(settled.clipPath).toBe("inset(0px)");
    expect(settled.iframe).toEqual({ width: 460, height: 520 });
  });

  it("matches iframe and shell when expanded", () => {
    expect(shellGeometry(expanded)).toEqual({
      iframe: { width: 460, height: 520 },
      shell: { width: 460, height: 520 },
      clipPath: "inset(0px)",
    });
  });
});

describe("shrinkHitOffset", () => {
  it("sits over the shrink chevron, not the close button", () => {
    // titlebar: 12px pad, 28px close, 12px gap, 28px shrink, 6px vertical pad (see TitleBar + styles.css)
    expect(shrinkHitOffset()).toEqual({ top: 0, right: 46, width: 40, height: 40 });
  });

  it("pins the host hit target in page coordinates above the iframe", () => {
    const hit = shrinkHitOffset();
    expect(shrinkHitPosition({ x: 100, y: 50, width: 460 })).toEqual({
      left: 100 + 460 - hit.right - hit.width,
      top: 50 + hit.top,
    });
  });
});

describe("applyShellStyles", () => {
  it("does not change iframe pixel size when the shell shrinks", () => {
    const shell = document.createElement("div");
    const frame = document.createElement("iframe");
    const state = { x: 10, y: 20, width: 460, height: 520, open: true, shrunk: false };

    applyShellStyles(shell, frame, state, { animate: false });
    const width = frame.style.width;
    const height = frame.style.height;
    applyShellStyles(shell, frame, { ...state, shrunk: true }, { animate: true });

    expect(frame.style.width).toBe(width);
    expect(frame.style.height).toBe(height);
    expect(shell.style.height).toBe("520px");
    expect(shell.style.clipPath).toBe(`inset(0px 0px ${520 - TITLEBAR_PX}px 0px)`);
    expect(shell.dataset.animate).toBe("true");
  });

  it("does not rewrite iframe pixels when settling the shrunk box", () => {
    const shell = document.createElement("div");
    const frame = document.createElement("iframe");
    const state = { x: 10, y: 20, width: 460, height: 520, open: true, shrunk: true };

    applyShellStyles(shell, frame, state, { animate: true, settle: false });
    const before = `${frame.style.width}|${frame.style.height}`;
    applyShellStyles(shell, frame, state, { animate: false, settle: true });

    expect(`${frame.style.width}|${frame.style.height}`).toBe(before);
    expect(shell.style.height).toBe(`${TITLEBAR_PX}px`);
    expect(shell.style.clipPath).toBe("inset(0px)");
  });

  it("can leave clip-path untouched so WAAPI owns the interpolation", () => {
    const shell = document.createElement("div");
    const frame = document.createElement("iframe");
    const state = { x: 10, y: 20, width: 460, height: 520, open: true, shrunk: true };
    applyShellStyles(shell, frame, state, { animate: false, settle: false });
    shell.style.clipPath = "inset(0px)";
    applyShellStyles(shell, frame, state, { animate: false, settle: false, clipPath: false });
    expect(shell.style.clipPath).toBe("inset(0px)");
  });
});

describe("clipAnimation", () => {
  it("does not emit a negative inset when height is below the title bar", () => {
    expect(shellClipPath(10, true)).toBe("inset(0px 0px 0px 0px)");
  });

  it("interpolates only clip-path, never iframe size", () => {
    const from = shellClipPath(520, false);
    const to = shellClipPath(520, true);
    expect(clipAnimation(from, to)).toEqual([{ clipPath: from }, { clipPath: to }]);
    expect(SHRINK_MS).toBe(160);
  });
});

describe("live resize", () => {
  it("scales the shell without changing iframe pixels", () => {
    const shell = document.createElement("div");
    const from = { width: 460, height: 520 };
    const to = { width: 230, height: 260 };
    expect(resizeScale(from, to)).toEqual({ sx: 0.5, sy: 0.5 });
    applyResizePreview(shell, from, to);
    expect(shell.style.transform).toBe("scale(0.5, 0.5)");
    expect(shell.style.transformOrigin).toBe("top left");
    expect(shell.style.willChange).toBe("transform");
    clearResizePreview(shell);
    expect(shell.style.transform).toBe("");
    expect(shell.style.willChange).toBe("");
  });

  it("clamps to a minimum and to the viewport", () => {
    expect(clampPanelSize({ width: 10, height: 10 }, { width: 800, height: 600 }, { x: 0, y: 0 })).toEqual({
      width: MIN_PANEL_WIDTH,
      height: MIN_PANEL_HEIGHT,
    });
    expect(clampPanelSize({ width: 900, height: 900 }, { width: 800, height: 600 }, { x: 100, y: 100 })).toEqual({
      width: 700,
      height: 500,
    });
  });

  it("places the resize handle on the bottom-right corner", () => {
    expect(resizeHitPosition({ x: 100, y: 50, width: 460, height: 520 })).toEqual({
      left: 100 + 460 - RESIZE_HIT_PX,
      top: 50 + 520 - RESIZE_HIT_PX,
    });
  });

  it("hides the resize handle until an expand clip has settled", () => {
    expect(resizeHitHidden({ open: true, shrunk: false }, false)).toBe(true);
    expect(resizeHitHidden({ open: true, shrunk: false }, true)).toBe(false);
    expect(resizeHitHidden({ open: true, shrunk: true }, true)).toBe(true);
    expect(resizeHitHidden({ open: false, shrunk: false }, true)).toBe(true);
  });
});
