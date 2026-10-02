import { afterEach, describe, expect, it, vi } from "vitest";

const load = () => import("./blobUrl.js");

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("objectUrlFor", () => {
  it("converts a data URL to one cached object URL with the decoded bytes", async () => {
    const blobs: Blob[] = [];
    const create = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return `blob:test/${blobs.length}`;
    });
    const { objectUrlFor } = await load();
    const url = `data:image/png;base64,${btoa("hello")}`;
    expect(objectUrlFor(url)).toBe("blob:test/1");
    expect(objectUrlFor(url)).toBe("blob:test/1");
    expect(create).toHaveBeenCalledTimes(1);
    expect(blobs[0]?.type).toBe("image/png");
    expect(await blobs[0]?.text()).toBe("hello");
  });

  it("revokes the least recently used object URL past the cache limit", async () => {
    let n = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => `blob:test/${(n += 1)}`);
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const { objectUrlFor } = await load();
    for (let i = 0; i < 9; i += 1) objectUrlFor(`data:image/png;base64,${btoa(String(i))}`);
    expect(revoke).toHaveBeenCalledWith("blob:test/1");
  });

  it("passes through non data URLs and undecodable input", async () => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:never");
    const { objectUrlFor } = await load();
    expect(objectUrlFor("blob:already")).toBe("blob:already");
    expect(objectUrlFor("data:image/png;base64,%%%")).toBe("data:image/png;base64,%%%");
  });
});
