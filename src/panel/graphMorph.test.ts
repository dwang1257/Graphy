import { describe, expect, it } from "vitest";

import { createMorphGeneration } from "./graphMorph.js";

describe("morph generation", () => {
  it("invalidates an older morph when a newer frame starts", () => {
    const generation = createMorphGeneration();
    const first = generation.next();
    const second = generation.next();

    expect(generation.isCurrent(first)).toBe(false);
    expect(generation.isCurrent(second)).toBe(true);
  });
});
