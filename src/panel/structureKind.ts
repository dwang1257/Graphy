import { KIND_LABELS, type StructureKind } from "../core/types.js";

export const UNSELECTED_KIND_LABEL = "Choose an Option:";

export function resolveStructureKind(value: string | undefined): StructureKind | undefined {
  if (value && value in KIND_LABELS) return value as StructureKind;
  return undefined;
}

export function structureKindLabel(kind: StructureKind | undefined): string {
  if (kind && kind in KIND_LABELS) return KIND_LABELS[kind];
  return UNSELECTED_KIND_LABEL;
}

export function structureKindOptions(): Array<[StructureKind, string]> {
  return Object.entries(KIND_LABELS) as Array<[StructureKind, string]>;
}
