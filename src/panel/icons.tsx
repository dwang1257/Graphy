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

export function PlusIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M8 3.5v9M3.5 8h9" />
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
