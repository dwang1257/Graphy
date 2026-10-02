import { afterEach, describe, expect, it, vi } from "vitest";

import { DARK_INK, LIGHT_INK } from "./imageInk.js";
import { stageBackgroundStyle, stageInkVars } from "./stageBackground.js";

afterEach(() => vi.restoreAllMocks());

describe("stage background", () => {
  it("covers the stage with the image through an object URL", () => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:stage");
    const style = stageBackgroundStyle("#101010", `data:image/png;base64,${btoa("x")}`);
    expect(style.backgroundImage).toBe('url("blob:stage")');
    expect(style.backgroundSize).toBe("cover");
    expect(style.backgroundColor).toBe("#101010");
  });

  it("uses only the color without an image", () => {
    expect(stageBackgroundStyle("#ffffff", null)).toEqual({ backgroundColor: "#ffffff" });
  });

  it("derives overlay ink from the image when known and the color otherwise", () => {
    expect(stageInkVars("#ffffff")).toEqual({ "--stage-ink": DARK_INK, "--stage-halo": LIGHT_INK });
    expect(stageInkVars("#ffffff", LIGHT_INK)).toEqual({ "--stage-ink": LIGHT_INK, "--stage-halo": DARK_INK });
  });
});
