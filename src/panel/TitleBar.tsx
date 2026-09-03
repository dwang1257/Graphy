import { useState } from "preact/hooks";
import type { JSX } from "preact";
import { CloseIcon, ExpandIcon, FitIcon, MinusIcon, PaintBrushIcon } from "./icons.js";
import { pointerDragHandler } from "./usePointerDrag.js";

interface Props {
  collapsed: boolean;
  showSettings: boolean;
  onFit: () => void;
  onToggleSettings: () => void;
  onCollapse: () => void;
  onClose: () => void;
  onDrag: (dx: number, dy: number) => void;
  onDragEnd: () => void;
}

export function TitleBar(props: Props): JSX.Element {
  const [dragging, setDragging] = useState(false);

  const onPointerDown = pointerDragHandler<HTMLDivElement>({
    ignore: "button",
    onStart: () => setDragging(true),
    onMove: props.onDrag,
    onEnd: () => {
      setDragging(false);
      props.onDragEnd();
    },
  });

  return (
    <div class={`titlebar${dragging ? " dragging" : ""}`} onPointerDown={onPointerDown}>
      <span class="brand">Graphy</span>

      <span class="spacer" />

      {!props.collapsed && (
        <>
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
            <PaintBrushIcon />
            Style
          </button>
        </>
      )}
      <button
        class="icon-btn"
        title={props.collapsed ? "Expand" : "Collapse"}
        aria-label={props.collapsed ? "Expand panel" : "Collapse panel"}
        onClick={props.onCollapse}
      >
        {props.collapsed ? <ExpandIcon /> : <MinusIcon />}
      </button>
      <button class="icon-btn" title="Close" aria-label="Close panel" onClick={props.onClose}>
        <CloseIcon />
      </button>
    </div>
  );
}
