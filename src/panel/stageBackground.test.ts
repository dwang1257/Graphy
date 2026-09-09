import { describe, expect, it } from "vitest";

import { stageBackgroundStyle } from "./stageBackground.js";

describe("stageBackgroundStyle", () => {
  it("stretches the full picture to the stage at any aspect ratio", () => {
    const style = stageBackgroundStyle("#ffffff", "data:image/png;base64,abc");

    expect(style.backgroundImage).toBe("url(data:image/png;base64,abc)");
    expect(style.backgroundSize).toBe("100% 100%");
    expect(style.backgroundPosition).toBe("center");
    expect(style.backgroundRepeat).toBe("no-repeat");
  });

  it("uses only the fallback color when there is no image", () => {
    expect(stageBackgroundStyle("#1a1a1a", null)).toEqual({ backgroundColor: "#1a1a1a" });
  });
});
