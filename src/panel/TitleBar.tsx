import { useState } from "preact/hooks";
import type { JSX } from "preact";
import { CloseIcon, ExpandIcon, FitIcon, GearIcon, MinusIcon } from "./icons.js";
import { KIND_LABELS, type StructureKind } from "../core/types.js";
import { pointerDragHandler } from "./usePointerDrag.js";

interface Props {
  collapsed: boolean;
  showSettings: boolean;
  detectedKind: StructureKind | null;
  overrideKind: StructureKind | "auto";
  directed: boolean;
  canToggleDirection: boolean;
  onKindChange: (kind: StructureKind | "auto") => void;
  onDirectionChange: (directed: boolean) => void;
  onFit: () => void;
  onToggleSettings: () => void;
  onCollapse: () => void;
  onClose: () => void;
  /** Deltas are reported in screen space so the moving iframe cannot skew them. */
  onDrag: (dx: number, dy: number) => void;
  onDragEnd: () => void;
}

const KINDS: Array<[StructureKind | "auto", string]> = [
  ["auto", "Auto"],
  ...(Object.entries(KIND_LABELS) as Array<[StructureKind, string]>),
];

export function TitleBar(props: Props): JSX.Element {
  const [dragging, setDragging] = useState(false);

  const onPointerDown = pointerDragHandler<HTMLDivElement>({
    ignore: "button, select",
    onStart: () => setDragging(true),
    onMove: props.onDrag,
    onEnd: () => {
      setDragging(false);
      props.onDragEnd();
    },
  });

  return (
    <div class={`titlebar${dragging ? " dragging" : ""}`} onPointerDown={onPointerDown}>
      <span class="brand"><span class="brand-dot" />Graphy</span>

      {!props.collapsed && (
        <>
          <select
            class="kind-select"
            value={props.overrideKind}
            title="Detected structure - override if the guess is wrong"
            onChange={(e) => props.onKindChange(e.currentTarget.value as StructureKind | "auto")}
          >
            {KINDS.map(([value, label]) => (
              <option value={value}>
                {value === "auto" && props.detectedKind ? `Auto - ${KIND_LABELS[props.detectedKind]}` : label}
              </option>
            ))}
          </select>

          {props.canToggleDirection && (
            <button
              class="icon-btn arrow-toggle"
              aria-pressed={props.directed}
              title={props.directed ? "Directed" : "Undirected"}
              onClick={() => props.onDirectionChange(!props.directed)}
            >
              {props.directed ? "→" : "—"}
            </button>
          )}
        </>
      )}

      <span class="spacer" />

      {!props.collapsed && (
        <>
          <button class="icon-btn" title="Fit to view" onClick={props.onFit}><FitIcon /></button>
          <button class="icon-btn" title="Settings" aria-pressed={props.showSettings} onClick={props.onToggleSettings}>
            <GearIcon />
          </button>
        </>
      )}
      <button class="icon-btn" title={props.collapsed ? "Expand" : "Collapse"} onClick={props.onCollapse}>
        {props.collapsed ? <ExpandIcon /> : <MinusIcon />}
      </button>
      <button class="icon-btn" title="Close" onClick={props.onClose}><CloseIcon /></button>
    </div>
  );
}

