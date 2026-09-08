import type { JSX } from "preact";

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 1.5,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": true,
} as const;

export function CloseIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function FitIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10" />
    </svg>
  );
}

export function ShrinkIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M3.5 6.5l4.5 4.5 4.5-4.5" />
    </svg>
  );
}

export function ExpandIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M3.5 9.5l4.5-4.5 4.5 4.5" />
    </svg>
  );
}

export function PlayIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M6 4.2v7.6L12.2 8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PauseIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M5.5 4v8M10.5 4v8" />
    </svg>
  );
}

export function StepBackIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M9.5 4.5L5 8l4.5 3.5" />
    </svg>
  );
}

export function StepForwardIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M6.5 4.5L11 8l-4.5 3.5" />
    </svg>
  );
}

export function CircleIcon(): JSX.Element {
  return (
    <svg {...base}>
      <circle cx="8" cy="8" r="4.5" />
    </svg>
  );
}

export function EllipseIcon(): JSX.Element {
  return (
    <svg {...base}>
      <ellipse cx="8" cy="8" rx="6" ry="3.8" />
    </svg>
  );
}

export function BoxIcon(): JSX.Element {
  return (
    <svg {...base}>
      <rect x="2.5" y="4.5" width="11" height="7" rx="0.5" />
    </svg>
  );
}

export function SquareIcon(): JSX.Element {
  return (
    <svg {...base}>
      <rect x="3.5" y="3.5" width="9" height="9" rx="0.5" />
    </svg>
  );
}

export function DiamondIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M8 2.8L13.2 8 8 13.2 2.8 8z" />
    </svg>
  );
}

export function HexagonIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M8 2.4L13 5.2v5.6L8 13.6 3 10.8V5.2z" />
    </svg>
  );
}

export function DoubleCircleIcon(): JSX.Element {
  return (
    <svg {...base}>
      <circle cx="8" cy="8" r="5.2" />
      <circle cx="8" cy="8" r="3" />
    </svg>
  );
}

export function EdgeSolidIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M2 8h12" />
    </svg>
  );
}

export function EdgeDashedIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M2 8h12" stroke-dasharray="3 2" />
    </svg>
  );
}

export function EdgeDottedIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M2 8h12" stroke-dasharray="1.2 2" />
    </svg>
  );
}

export function EdgeBoldIcon(): JSX.Element {
  return (
    <svg {...base}>
      <rect x="2" y="6.2" width="12" height="3.6" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
