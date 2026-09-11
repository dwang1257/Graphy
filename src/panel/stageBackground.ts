import type { JSX } from "preact";

import { stageOverlayInk } from "./imageInk.js";

export function stageInkVars(
  background: string,
  imageInk: string | null = null,
): { "--stage-ink": string; "--stage-halo": string } {
  const { ink, halo } = stageOverlayInk(background, imageInk);
  return { "--stage-ink": ink, "--stage-halo": halo };
}

export function stageBackgroundStyle(
  background: string,
  backgroundImage: string | null,
): JSX.CSSProperties {
  if (!backgroundImage) return { backgroundColor: background };
  return {
    backgroundColor: background,
    backgroundImage: `url(${backgroundImage})`,
    backgroundSize: "100% 100%",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
    imageRendering: "auto",
  };
}
