import type { JSX } from "preact";
import { useEffect, useState } from "preact/hooks";

import { objectUrlFor } from "./blobUrl.js";
import { stageOverlayInk } from "./imageInk.js";

const MAX_CACHED_ASPECTS = 8;
const aspects = new Map<string, number | null>();

export function stageInkVars(
  background: string,
  imageInk: string | null = null,
): { "--stage-ink": string; "--stage-halo": string } {
  const { ink, halo } = stageOverlayInk(background, imageInk);
  return { "--stage-ink": ink, "--stage-halo": halo };
}

function measureAspect(url: string): Promise<number | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = image;
      resolve(width > 0 && height > 0 ? width / height : null);
    };
    image.onerror = () => resolve(null);
    image.src = objectUrlFor(url);
  });
}

function remember(url: string, aspect: number | null): void {
  aspects.set(url, aspect);
  while (aspects.size > MAX_CACHED_ASPECTS) {
    const oldest = aspects.keys().next().value;
    if (oldest === undefined) break;
    aspects.delete(oldest);
  }
}

export function useImageAspect(url: string | null, measure: (url: string) => Promise<number | null> = measureAspect): number | null {
  const [, setResolved] = useState(0);
  useEffect(() => {
    if (!url || aspects.has(url)) return;
    let cancelled = false;
    void measure(url).then((aspect) => {
      remember(url, aspect);
      if (!cancelled) setResolved((n) => n + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [url, measure]);
  return url ? (aspects.get(url) ?? null) : null;
}

export function clearImageAspectCache(): void {
  aspects.clear();
}

export function stageBackdropStyle(backgroundImage: string | null, aspect: number | null): JSX.CSSProperties | null {
  if (!backgroundImage || !aspect) return null;
  return {
    "--stage-image": `url("${objectUrlFor(backgroundImage).replace(/["\\\n]/g, "")}")`,
    "--stage-image-aspect": String(aspect),
  } as JSX.CSSProperties;
}
