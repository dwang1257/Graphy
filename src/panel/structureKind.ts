import { KIND_LABELS, type StructureKind } from "../core/types.js";

export const DEFAULT_STRUCTURE_KIND: StructureKind = "binary-tree";

export function resolveStructureKind(value: string | undefined): StructureKind {
  if (value && value in KIND_LABELS) return value as StructureKind;
  return DEFAULT_STRUCTURE_KIND;
}

export function structureKindOptions(): Array<[StructureKind, string]> {
  return Object.entries(KIND_LABELS) as Array<[StructureKind, string]>;
}
