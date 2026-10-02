import { Window } from "happy-dom";
import { render } from "preact";
import { act } from "preact/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DARK_INK, LIGHT_INK } from "./imageInk.js";
import { clearImageAspectCache, stageBackdropStyle, stageInkVars, useImageAspect } from "./stageBackground.js";

let container: HTMLDivElement;
let latest: number | null | undefined;

function Probe(props: { url: string | null; measure: (url: string) => Promise<number | null> }) {
  latest = useImageAspect(props.url, props.measure);
  return null;
}

async function show(url: string | null, measure: (url: string) => Promise<number | null>): Promise<void> {
  await act(async () => {
    render(<Probe url={url} measure={measure} />, container);
  });
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.stubGlobal("document", new Window().document);
  container = document.createElement("div") as unknown as HTMLDivElement;
});

afterEach(() => {
  render(null, container);
  clearImageAspectCache();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("stage backdrop", () => {
  it("exposes the image and its aspect ratio to the backdrop layers", () => {
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => "blob:stage");
    expect(stageBackdropStyle(`data:image/png;base64,${btoa("x")}`, 16 / 9)).toEqual({
      "--stage-image": 'url("blob:stage")',
      "--stage-image-aspect": String(16 / 9),
    });
  });

  it("renders no backdrop without an image or before its size is known", () => {
    expect(stageBackdropStyle(null, 1.5)).toBeNull();
    expect(stageBackdropStyle("data:image/png;base64,eA==", null)).toBeNull();
  });

  it("measures each image once and serves the aspect from cache afterwards", async () => {
    const measure = vi.fn(async () => 2);
    await show("data:wide", measure);
    expect(latest).toBe(2);
    await show(null, measure);
    expect(latest).toBeNull();
    await show("data:wide", measure);
    expect(latest).toBe(2);
    expect(measure).toHaveBeenCalledTimes(1);
  });

  it("remembers unreadable images as having no aspect", async () => {
    const measure = vi.fn(async () => null);
    await show("data:bad", measure);
    await show("data:bad", measure);
    expect(latest).toBeNull();
    expect(measure).toHaveBeenCalledTimes(1);
  });

  it("derives overlay ink from the image when known and the color otherwise", () => {
    expect(stageInkVars("#ffffff")).toEqual({ "--stage-ink": DARK_INK, "--stage-halo": LIGHT_INK });
    expect(stageInkVars("#ffffff", LIGHT_INK)).toEqual({ "--stage-ink": LIGHT_INK, "--stage-halo": DARK_INK });
  });
});
