export const PAINT_ROLES = [
  "nodeFill",
  "nodeStroke",
  "nodeInk",
  "rootFill",
  "rootStroke",
  "rootInk",
  "terminal",
  "edge",
  "edgeText",
  "cycle",
  "cellFill",
  "cellEmptyFill",
  "cellStroke",
  "cellText",
  "gutterText",
] as const;

export type PaintRole = (typeof PAINT_ROLES)[number];

export type PaintColors = Record<PaintRole, string>;

function placeholderFor(index: number): string {
  return `#ab00${(index + 1).toString(16).padStart(2, "0")}`;
}

export const PLACEHOLDER = Object.fromEntries(
  PAINT_ROLES.map((role, index) => [role, placeholderFor(index)]),
) as PaintColors;

const ROLE_BY_PLACEHOLDER = new Map<string, PaintRole>(
  PAINT_ROLES.map((role) => [PLACEHOLDER[role], role]),
);

export function roleOfPlaceholder(color: string | null | undefined): PaintRole | undefined {
  return color ? ROLE_BY_PLACEHOLDER.get(color.trim().toLowerCase()) : undefined;
}

export function isPaintRole(value: string | null | undefined): value is PaintRole {
  return !!value && (PAINT_ROLES as readonly string[]).includes(value);
}
