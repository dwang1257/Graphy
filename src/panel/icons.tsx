import type { JSX } from "preact";

const base = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": 1.6,
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
} as const;

export function PaintBrushIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M3.5 12.5c0-1.2.5-2.3 1.3-3.1L9.5 4.2a2.2 2.2 0 0 1 3.1 3.1L7.9 12.5a2.2 2.2 0 0 1-3.1 0 2.2 2.2 0 0 1-1.3-0z" />
      <path d="M10.5 3.5 12.5 5.5" />
    </svg>
  );
}

export function GearIcon(): JSX.Element {
  return (
    <svg {...base}>
      <circle cx="8" cy="8" r="2.3" />
      <path d="M8 1.4v1.6M8 13v1.6M14.6 8H13M3 8H1.4M12.7 3.3l-1.1 1.1M4.4 11.6l-1.1 1.1M12.7 12.7l-1.1-1.1M4.4 4.4L3.3 3.3" />
    </svg>
  );
}

export function MinusIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M3.5 8h9" />
    </svg>
  );
}

export function ExpandIcon(): JSX.Element {
  return (
    <svg {...base}>
      <path d="M3.5 6.5 8 11l4.5-4.5" />
    </svg>
  );
}

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

export function GripIcon(): JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
      <path d="M13.5 5.5 5.5 13.5M13.5 10.5l-3 3" />
    </svg>
  );
}
