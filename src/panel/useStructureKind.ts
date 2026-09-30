import { useCallback, useState } from "preact/hooks";

import type { StructureKind } from "../core/types.js";
import { displayedStructureKind, pendingKindForSlug, type PendingStructureKind } from "./structureKind.js";

export function useStructureKind(
  slug: string,
  savedKind: string | undefined,
  persist: (kind: StructureKind | undefined) => void,
): {
  selectedKind: StructureKind | undefined;
  setKind: (kind: StructureKind | undefined) => void;
} {
  const [pendingKind, setPendingKind] = useState<PendingStructureKind>();
  const selectedKind = displayedStructureKind(savedKind, pendingKindForSlug(pendingKind, slug));

  const setKind = useCallback(
    (kind: StructureKind | undefined) => {
      setPendingKind({ slug, kind: kind ?? null });
      if (slug) persist(kind);
    },
    [persist, slug],
  );

  return { selectedKind, setKind };
}
