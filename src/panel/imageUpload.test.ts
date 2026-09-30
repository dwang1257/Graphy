import { describe, expect, it, vi } from "vitest";

import { DEFAULT_SETTINGS, type Settings } from "../settings/schema.js";
import {
  IMAGE_BUDGETS,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_DIMENSION,
  compactImageDataUrl,
  compactSettingsImages,
  readImageDataUrl,
} from "./imageUpload.js";

function file(options: { type?: string; size?: number } = {}): File {
  return {
    name: "upload.png",
    type: options.type ?? "image/png",
    size: options.size ?? 100,
  } as File;
}

function dataUrl(chars: number): string {
  const prefix = "data:image/png;base64,";
  return prefix + "A".repeat(Math.max(0, chars - prefix.length));
}

function platform(options: {
  width?: number;
  height?: number;
  original?: string;
  encodedChars?: (size: { width: number; height: number }, quality: number) => number;
  decodeError?: Error;
  readError?: Error;
}) {
  return {
    decode: vi.fn(async () => {
      if (options.decodeError) throw options.decodeError;
      return { width: options.width ?? 640, height: options.height ?? 480 };
    }),
    encode: vi.fn(async (_file: Blob, size: { width: number; height: number }, quality: number) =>
      dataUrl(options.encodedChars?.(size, quality) ?? 1000),
    ),
    readAsDataUrl: vi.fn(async () => {
      if (options.readError) throw options.readError;
      return options.original ?? "data:image/png;base64,valid";
    }),
    toBlob: vi.fn(async (url: string) => ({ size: url.length, type: "image/png" }) as Blob),
  };
}

describe("readImageDataUrl", () => {
  it("rejects non-image MIME types before decoding", async () => {
    const browser = platform({});

    await expect(readImageDataUrl(file({ type: "text/plain" }), "backgroundImage", browser)).rejects.toThrow(
      "Choose an image file.",
    );
    expect(browser.decode).not.toHaveBeenCalled();
  });

  it("rejects oversized files before decoding", async () => {
    const browser = platform({});

    await expect(
      readImageDataUrl(file({ size: MAX_IMAGE_BYTES + 1 }), "backgroundImage", browser),
    ).rejects.toThrow("Image must be 4 MB or smaller.");
    expect(browser.decode).not.toHaveBeenCalled();
  });

  it("rejects oversized dimensions before reading the data URL", async () => {
    const browser = platform({ width: MAX_IMAGE_DIMENSION + 1, height: 100 });

    await expect(readImageDataUrl(file(), "backgroundImage", browser)).rejects.toThrow(
      "Image dimensions must be 4096 × 4096 pixels or smaller.",
    );
    expect(browser.readAsDataUrl).not.toHaveBeenCalled();
  });

  it("keeps a small image that already fits its slot untouched", async () => {
    const browser = platform({});

    await expect(readImageDataUrl(file(), "backgroundImage", browser)).resolves.toBe("data:image/png;base64,valid");
    expect(browser.decode).toHaveBeenCalledOnce();
    expect(browser.encode).not.toHaveBeenCalled();
  });

  it("downscales an image larger than its slot to the slot dimension", async () => {
    const browser = platform({ width: 2000, height: 1000 });

    await readImageDataUrl(file(), "nodeBackgroundImage", browser);

    expect(browser.readAsDataUrl).not.toHaveBeenCalled();
    expect(browser.encode).toHaveBeenCalledWith(expect.anything(), { width: 512, height: 256 }, 0.85);
  });

  it("re-encodes a heavy file even when its dimensions fit", async () => {
    const browser = platform({ width: 1000, height: 1000 });

    await readImageDataUrl(file({ size: 3 * 1024 * 1024 }), "backgroundImage", browser);

    expect(browser.readAsDataUrl).not.toHaveBeenCalled();
    expect(browser.encode).toHaveBeenCalledWith(expect.anything(), { width: 1000, height: 1000 }, 0.85);
  });

  it("steps quality then dimension down until the result fits the slot budget", async () => {
    const budget = IMAGE_BUDGETS.backgroundImage.chars;
    const browser = platform({
      width: 4000,
      height: 2000,
      encodedChars: (size) => (size.width > 1024 ? budget + 1 : budget),
    });

    const url = await readImageDataUrl(file({ size: 3 * 1024 * 1024 }), "backgroundImage", browser);

    expect(url.length).toBeLessThanOrEqual(budget);
    expect(browser.encode.mock.calls.map(([, size, quality]) => [size.width, quality])).toEqual([
      [2048, 0.85],
      [2048, 0.7],
      [2048, 0.55],
      [1024, 0.85],
    ]);
  });

  it("turns decode, reader, and encoder failures into readable upload errors", async () => {
    const message = "Graphy could not read that image. Try another image file.";
    await expect(
      readImageDataUrl(file(), "backgroundImage", platform({ decodeError: new Error("decode failed") })),
    ).rejects.toThrow(message);
    await expect(
      readImageDataUrl(file(), "backgroundImage", platform({ readError: new Error("reader failed") })),
    ).rejects.toThrow(message);
    await expect(
      readImageDataUrl(
        file({ size: 3 * 1024 * 1024 }),
        "backgroundImage",
        platform({ encodedChars: () => IMAGE_BUDGETS.backgroundImage.chars + 1 }),
      ),
    ).rejects.toThrow(message);
  });
});

describe("compactImageDataUrl", () => {
  it("leaves images within budget alone without decoding", async () => {
    const browser = platform({});
    const url = dataUrl(IMAGE_BUDGETS.nodeBackgroundImage.chars);

    await expect(compactImageDataUrl(url, "nodeBackgroundImage", browser)).resolves.toBe(url);
    expect(browser.toBlob).not.toHaveBeenCalled();
  });

  it("re-encodes an oversized legacy image into its slot budget", async () => {
    const browser = platform({ width: 3000, height: 3000 });

    const url = await compactImageDataUrl(dataUrl(5_000_000), "backgroundImage", browser);

    expect(url.length).toBeLessThanOrEqual(IMAGE_BUDGETS.backgroundImage.chars);
    expect(browser.encode).toHaveBeenCalledWith(expect.anything(), { width: 2048, height: 2048 }, 0.85);
  });
});

describe("compactSettingsImages", () => {
  function withImages(images: Partial<Settings["light"]>, dark: Partial<Settings["dark"]> = {}): Settings {
    return {
      ...DEFAULT_SETTINGS,
      light: { ...DEFAULT_SETTINGS.light, ...images },
      dark: { ...DEFAULT_SETTINGS.dark, ...dark },
    };
  }

  it("returns the same object when nothing needs compacting", async () => {
    const settings = withImages({ backgroundImage: "data:image/png;base64,small" });

    await expect(compactSettingsImages(settings, platform({}))).resolves.toBe(settings);
  });

  it("replaces only oversized images and keeps an image whose compaction fails", async () => {
    const huge = dataUrl(3_000_000);
    const browser = platform({ width: 3000, height: 3000 });
    browser.decode.mockRejectedValueOnce(new Error("decode failed"));
    const settings = withImages(
      { backgroundImage: huge, nodeBackgroundImage: "data:image/png;base64,small" },
      { backgroundImage: huge },
    );

    const next = await compactSettingsImages(settings, browser);

    expect(next.light.backgroundImage).toBe(huge);
    expect(next.light.nodeBackgroundImage).toBe("data:image/png;base64,small");
    expect(next.dark.backgroundImage!.length).toBeLessThanOrEqual(IMAGE_BUDGETS.backgroundImage.chars);
  });
});
