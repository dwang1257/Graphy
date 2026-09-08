import { useCallback, useEffect, useState } from "preact/hooks";

import type { StructureKind } from "../core/types.js";
import { displayedStructureKind } from "./structureKind.js";

export function useStructureKind(
  slug: string,
  savedKind: string | undefined,
  persist: (kind: StructureKind) => void,
): {
  selectedKind: StructureKind | undefined;
  setKind: (kind: StructureKind) => void;
} {
  const [pendingKind, setPendingKind] = useState<StructureKind | undefined>();
  const selectedKind = displayedStructureKind(savedKind, pendingKind);

  const setKind = useCallback(
    (kind: StructureKind) => {
      setPendingKind(kind);
      persist(kind);
    },
    [persist],
  );

  useEffect(() => {
    if (slug && pendingKind) persist(pendingKind);
  }, [pendingKind, persist, slug]);

  return { selectedKind, setKind };
}
