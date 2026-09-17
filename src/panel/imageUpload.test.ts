import { describe, expect, it, vi } from "vitest";

import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  readImageDataUrl,
} from "./imageUpload.js";

function file(options: { type?: string; size?: number } = {}): File {
  return {
    name: "upload.png",
    type: options.type ?? "image/png",
    size: options.size ?? 100,
  } as File;
}

function platform(options: {
  width?: number;
  height?: number;
  decodeError?: Error;
  readError?: Error;
}) {
  return {
    decode: vi.fn(async () => {
      if (options.decodeError) throw options.decodeError;
      return { width: options.width ?? 640, height: options.height ?? 480 };
    }),
    readAsDataUrl: vi.fn(async () => {
      if (options.readError) throw options.readError;
      return "data:image/png;base64,valid";
    }),
  };
}

describe("readImageDataUrl", () => {
  it("rejects non-image MIME types before decoding", async () => {
    const browser = platform({});

    await expect(readImageDataUrl(file({ type: "text/plain" }), browser)).rejects.toThrow(
      "Choose an image file.",
    );
    expect(browser.decode).not.toHaveBeenCalled();
  });

  it("rejects oversized files before decoding", async () => {
    const browser = platform({});

    await expect(readImageDataUrl(file({ size: MAX_IMAGE_BYTES + 1 }), browser)).rejects.toThrow(
      "Image must be 4 MB or smaller.",
    );
    expect(browser.decode).not.toHaveBeenCalled();
  });

  it("rejects oversized dimensions before reading the data URL", async () => {
    const browser = platform({ width: MAX_IMAGE_DIMENSION + 1, height: 100 });

    await expect(readImageDataUrl(file(), browser)).rejects.toThrow(
      "Image dimensions must be 4096 × 4096 pixels or smaller.",
    );
    expect(browser.readAsDataUrl).not.toHaveBeenCalled();
  });

  it("returns a data URL for a valid image", async () => {
    const browser = platform({});

    await expect(readImageDataUrl(file(), browser)).resolves.toBe("data:image/png;base64,valid");
    expect(browser.decode).toHaveBeenCalledOnce();
    expect(browser.readAsDataUrl).toHaveBeenCalledOnce();
  });

  it("turns decode and reader failures into readable upload errors", async () => {
    await expect(
      readImageDataUrl(file(), platform({ decodeError: new Error("decode failed") })),
    ).rejects.toThrow("Graphy could not read that image. Try another image file.");
    await expect(
      readImageDataUrl(file(), platform({ readError: new Error("reader failed") })),
    ).rejects.toThrow("Graphy could not read that image. Try another image file.");
  });
});
