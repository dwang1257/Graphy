import { useState } from "preact/hooks";
import type { JSX } from "preact";
import { CloseIcon, ExpandIcon, FitIcon, ShrinkIcon } from "./icons.js";
import { KIND_LABELS, type StructureKind } from "../core/types.js";
import { UNSELECTED_KIND_LABEL, structureKindLabel, structureKindOptions } from "./structureKind.js";
import { pointerDragHandler } from "./usePointerDrag.js";

interface Props {
  showSettings: boolean;
  selectedKind: StructureKind | undefined;
  onKindChange: (kind: StructureKind) => void;
  onFit: () => void;
  onToggleSettings: () => void;
  onClose: () => void;
  shrunk: boolean;
  onToggleShrunk: () => void;
  onDrag: (dx: number, dy: number) => void;
  onDragEnd: () => void;
}

export function TitleBar(props: Props): JSX.Element {
  const [dragging, setDragging] = useState(false);

  const onPointerDown = pointerDragHandler<HTMLDivElement>({
    ignore: "button, select, label",
    onStart: () => setDragging(true),
    onMove: props.onDrag,
    onEnd: () => {
      setDragging(false);
      props.onDragEnd();
    },
  });

  return (
    <div class={`titlebar${dragging ? " dragging" : ""}`} onPointerDown={onPointerDown}>
      <label class="kind-field">
        <span class="kind-value" aria-hidden="true">
          {structureKindLabel(props.selectedKind)}
        </span>
        <select
          class="kind-select"
          value={props.selectedKind ?? ""}
          title="Structure to draw"
          aria-label={structureKindLabel(props.selectedKind)}
          onChange={(e) => {
            const value = e.currentTarget.value;
            if (value in KIND_LABELS) props.onKindChange(value as StructureKind);
            e.currentTarget.blur();
          }}
        >
          <option value="">{UNSELECTED_KIND_LABEL}</option>
          {structureKindOptions().map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <span class="spacer" />

      <button class="icon-btn" title="Fit to view" aria-label="Fit to view" onClick={props.onFit}>
        <FitIcon />
      </button>
      <button
        class={`style-btn${props.showSettings ? " active" : ""}`}
        title="Style your graph"
        aria-label="Style your graph"
        aria-pressed={props.showSettings}
        onClick={props.onToggleSettings}
      >
        Style
      </button>
      <button
        class="icon-btn"
        title={props.shrunk ? "Expand" : "Shrink"}
        aria-label={props.shrunk ? "Expand panel" : "Shrink panel"}
        aria-pressed={props.shrunk}
        onClick={props.onToggleShrunk}
      >
        {props.shrunk ? <ExpandIcon /> : <ShrinkIcon />}
      </button>
      <button class="icon-btn" title="Close" aria-label="Close panel" onClick={props.onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}
