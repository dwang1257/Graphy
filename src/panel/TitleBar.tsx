import { useState } from "preact/hooks";
import type { JSX } from "preact";
import { CloseIcon, FitIcon } from "./icons.js";
import { KIND_LABELS, type StructureKind } from "../core/types.js";
import { structureKindOptions } from "./structureKind.js";
import { pointerDragHandler } from "./usePointerDrag.js";

interface Props {
  showSettings: boolean;
  selectedKind: StructureKind;
  onKindChange: (kind: StructureKind) => void;
  onFit: () => void;
  onToggleSettings: () => void;
  onClose: () => void;
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
          {KIND_LABELS[props.selectedKind]}
        </span>
        <select
          class="kind-select"
          value={props.selectedKind}
          title="Structure to draw"
          aria-label="Structure"
          onChange={(e) => {
            const value = e.currentTarget.value;
            if (value in KIND_LABELS) props.onKindChange(value as StructureKind);
            e.currentTarget.blur();
          }}
        >
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
      <button class="icon-btn" title="Close" aria-label="Close panel" onClick={props.onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}
