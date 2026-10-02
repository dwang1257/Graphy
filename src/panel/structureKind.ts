import { KIND_LABELS, STRUCTURE_KINDS, isStructureKind, type StructureKind } from "../core/types.js";

const UNSELECTED_KIND_LABEL = "Choose a structure";

const AUTO_KIND_LABEL = "Auto";

export const NONE_KIND_LABEL = "None";

export interface PendingStructureKind {
  slug: string;
  kind: StructureKind | null;
}

export function pendingKindForSlug(
  pending: PendingStructureKind | undefined,
  slug: string,
): StructureKind | null | undefined {
  return pending?.slug === slug ? pending.kind : undefined;
}

export function displayedStructureKind(
  savedKind: string | undefined,
  pendingKind: StructureKind | null | undefined,
): StructureKind | undefined {
  if (pendingKind === null) return undefined;
  return pendingKind ?? (isStructureKind(savedKind) ? savedKind : undefined);
}

function uniqueKinds(kinds: ReadonlyArray<StructureKind | undefined>): StructureKind[] {
  const out: StructureKind[] = [];
  for (const kind of kinds) {
    if (kind && !out.includes(kind)) out.push(kind);
  }
  return out;
}

export function autoKindLabel(detected: ReadonlyArray<StructureKind | undefined>): string {
  const kinds = uniqueKinds(detected);
  if (kinds.length === 0) return AUTO_KIND_LABEL;
  return `${AUTO_KIND_LABEL} (${kinds.map((kind) => KIND_LABELS[kind]).join(" + ")})`;
}

export function structureKindLabel(
  selected: StructureKind | undefined,
  detected: ReadonlyArray<StructureKind | undefined> = [],
): string {
  if (selected) return KIND_LABELS[selected];
  const kinds = uniqueKinds(detected);
  if (kinds.length > 0) return kinds.map((kind) => KIND_LABELS[kind]).join(" + ");
  return UNSELECTED_KIND_LABEL;
}

export function structureKindOptions(): Array<[StructureKind, string]> {
  return STRUCTURE_KINDS.map((kind) => [kind, KIND_LABELS[kind]]);
}
