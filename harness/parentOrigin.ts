import * as real from "../src/panel/parentOrigin.js";

export * from "../src/panel/parentOrigin.js";

const HARNESS_ORIGIN = location.origin;

export function isAllowedParentOrigin(origin: string): boolean {
  return origin === HARNESS_ORIGIN || real.isAllowedParentOrigin(origin);
}

export function detectParentOrigin(
  loc: Pick<Location, "ancestorOrigins"> = location,
  doc: Pick<Document, "referrer"> = document,
): string | null {
  return loc.ancestorOrigins[0] === HARNESS_ORIGIN ? HARNESS_ORIGIN : real.detectParentOrigin(loc, doc);
}
