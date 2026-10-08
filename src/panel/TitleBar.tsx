import { useState } from "preact/hooks";
import type { JSX } from "preact";
import { CloseIcon, ExpandIcon, FitIcon, ShrinkIcon } from "./icons.js";
import { isStructureKind, type StructureKind } from "../core/types.js";
import { autoKindLabel, structureKindLabel, structureKindOptions } from "./structureKind.js";
import { memo } from "./memo.js";
import { STYLE_DRAWER_ID } from "./styleOptions.js";
import { pointerDragHandler } from "./usePointerDrag.js";
import { ReviewLink } from "./ReviewLink.js";
import { SuggestionBox } from "./SuggestionBox.js";

interface Props {
  slug: string;
  showSettings: boolean;
  selectedKind: StructureKind | undefined;
  detectedKinds: ReadonlyArray<StructureKind | undefined>;
  onKindChange: (kind: StructureKind | undefined) => void;
  onFit: () => void;
  onToggleSettings: () => void;
  onClose: () => void;
  shrunk: boolean;
  onToggleShrunk: () => void;
  onDrag: (dx: number, dy: number) => void;
  onDragEnd: () => void;
}

function TitleBarView(props: Props): JSX.Element {
  const [dragging, setDragging] = useState(false);

  const onPointerDown = pointerDragHandler<HTMLDivElement>({
    ignore: "button, select, label, a, textarea, .review-prompt, .suggest-popover",
    onStart: () => setDragging(true),
    onMove: props.onDrag,
    onEnd: () => {
      setDragging(false);
      props.onDragEnd();
    },
  });

  const kindLabel = structureKindLabel(props.selectedKind, props.detectedKinds);

  return (
    <div class={`titlebar${dragging ? " dragging" : ""}`} onPointerDown={onPointerDown}>
      <label class="kind-field">
        <span class="kind-value" aria-hidden="true">
          {kindLabel}
        </span>
        <select
          class="kind-select"
          value={props.selectedKind ?? ""}
          title="Structure to draw"
          aria-label={`Structure to draw: ${kindLabel}`}
          onChange={(e) => {
            const value = e.currentTarget.value;
            props.onKindChange(isStructureKind(value) ? value : undefined);
            e.currentTarget.blur();
          }}
        >
          <option value="">{autoKindLabel(props.detectedKinds)}</option>
          {structureKindOptions().map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <SuggestionBox shrunk={props.shrunk} slug={props.slug} />
      <ReviewLink shrunk={props.shrunk} />

      <span class="spacer" />

      <button type="button" class="icon-btn" title="Fit to view" aria-label="Fit to view" onClick={props.onFit}>
        <FitIcon />
      </button>
      <button
        type="button"
        class="style-btn"
        title="Style the graph"
        aria-haspopup="dialog"
        aria-expanded={props.showSettings}
        aria-controls={STYLE_DRAWER_ID}
        onClick={props.onToggleSettings}
      >
        Style
      </button>
      <button
        type="button"
        class="icon-btn"
        title={props.shrunk ? "Expand" : "Shrink"}
        aria-label={props.shrunk ? "Expand panel" : "Shrink panel"}
        onClick={props.onToggleShrunk}
      >
        {props.shrunk ? <ExpandIcon /> : <ShrinkIcon />}
      </button>
      <button type="button" class="icon-btn" title="Close" aria-label="Close panel" onClick={props.onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}

export const TitleBar = memo(TitleBarView);
