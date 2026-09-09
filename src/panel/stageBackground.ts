import type { JSX } from "preact";

/** Stage fill that shows the whole photo, stretched to the window on every ratio. */
export function stageBackgroundStyle(
  background: string,
  backgroundImage: string | null,
): JSX.CSSProperties {
  const style: JSX.CSSProperties = { backgroundColor: background };
  if (backgroundImage) {
    style.backgroundImage = `url(${backgroundImage})`;
    style.backgroundSize = "100% 100%";
    style.backgroundPosition = "center";
    style.backgroundRepeat = "no-repeat";
  }
  return style;
}
