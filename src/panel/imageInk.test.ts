import { afterEach, describe, expect, it, vi } from "vitest";

import { DARK_INK, LIGHT_INK, clearImageInkCache, imageInkOf, peekImageInk } from "./imageInk.js";

afterEach(() => clearImageInkCache());

describe("image ink cache", () => {
  it("computes the ink once per image and serves it synchronously afterwards", async () => {
    const compute = vi.fn(async () => DARK_INK);
    expect(peekImageInk("data:a")).toBeUndefined();
    const [first, second] = await Promise.all([imageInkOf("data:a", compute), imageInkOf("data:a", compute)]);
    expect(first).toBe(DARK_INK);
    expect(second).toBe(DARK_INK);
    expect(peekImageInk("data:a")).toBe(DARK_INK);
    await imageInkOf("data:a", compute);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("remembers failures as no ink instead of retrying every render", async () => {
    const compute = vi.fn(async () => {
      throw new Error("decode failed");
    });
    await expect(imageInkOf("data:bad", compute)).resolves.toBeNull();
    expect(peekImageInk("data:bad")).toBeNull();
    await imageInkOf("data:bad", compute);
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it("keeps different images apart", async () => {
    await imageInkOf("data:light", async () => DARK_INK);
    await imageInkOf("data:dark", async () => LIGHT_INK);
    expect(peekImageInk("data:light")).toBe(DARK_INK);
    expect(peekImageInk("data:dark")).toBe(LIGHT_INK);
  });
});
