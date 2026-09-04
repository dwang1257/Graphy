import { useState } from "preact/hooks";
import type { JSX } from "preact";
import { CloseIcon, FitIcon } from "./icons.js";
import { KIND_LABELS, type StructureKind } from "../core/types.js";
import { pointerDragHandler } from "./usePointerDrag.js";

interface Props {
  showSettings: boolean;
  selectedKind: StructureKind | undefined;
  onKindChange: (kind: StructureKind) => void;
  onFit: () => void;
  onToggleSettings: () => void;
  onClose: () => void;
  onDrag: (dx: number, dy: number) => void;
  onDragEnd: () => void;
}

const KINDS = Object.entries(KIND_LABELS) as Array<[StructureKind, string]>;

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
        <select
          class={`kind-select${props.selectedKind ? "" : " kind-select-empty"}`}
          value={props.selectedKind ?? ""}
          title="Choose which structure to draw"
          aria-label="Structure"
          required
          onChange={(e) => {
            const value = e.currentTarget.value;
            if (value in KIND_LABELS) props.onKindChange(value as StructureKind);
          }}
        >
          <option value="" disabled>
            Choose…
          </option>
          {KINDS.map(([value, label]) => (
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
