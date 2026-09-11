import { describe, expect, it } from "vitest";

import { DARK_INK, LIGHT_INK } from "./imageInk.js";
import { stageBackgroundStyle, stageInkVars } from "./stageBackground.js";

describe("stageBackgroundStyle", () => {
  it("stretches the full picture to the stage at any aspect ratio", () => {
    const style = stageBackgroundStyle("#ffffff", "data:image/png;base64,abc");

    expect(style).toEqual({
      backgroundColor: "#ffffff",
      backgroundImage: "url(data:image/png;base64,abc)",
      backgroundSize: "100% 100%",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
      imageRendering: "auto",
    });
  });

  it("uses only the fallback color when there is no image", () => {
    expect(stageBackgroundStyle("#1a1a1a", null)).toEqual({ backgroundColor: "#1a1a1a" });
  });
});

describe("stageInkVars", () => {
  it("sets contrast ink and the opposite halo from a light fill", () => {
    expect(stageInkVars("#ffffff")).toEqual({
      "--stage-ink": DARK_INK,
      "--stage-halo": LIGHT_INK,
    });
  });

  it("sets contrast ink and the opposite halo from a dark fill", () => {
    expect(stageInkVars("#1a1a1a")).toEqual({
      "--stage-ink": LIGHT_INK,
      "--stage-halo": DARK_INK,
    });
  });

  it("sets photo ink over the solid fill when image ink is known", () => {
    expect(stageInkVars("#ffffff", LIGHT_INK)).toEqual({
      "--stage-ink": LIGHT_INK,
      "--stage-halo": DARK_INK,
    });
  });
});
