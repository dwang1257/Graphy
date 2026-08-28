const PARENT_ORIGINS = new Set(["https://leetcode.com", "https://leetcode.cn"]);

export function isAllowedParentOrigin(origin: string): boolean {
  return PARENT_ORIGINS.has(origin);
}

/**
 * The panel iframe lives on `chrome-extension://…`; its parent is the LeetCode
 * tab. `postMessage` targetOrigin and inbound `event.origin` must be that
 * parent, not the iframe's own origin, or close/move/snapshot all go nowhere.
 */
export function resolveParentOrigin(input: {
  ancestorOrigin: string;
  referrer: string;
}): string | null {
  if (input.ancestorOrigin && isAllowedParentOrigin(input.ancestorOrigin)) {
    return input.ancestorOrigin;
  }
  if (!input.referrer) return null;
  try {
    const referrerOrigin = new URL(input.referrer).origin;
    return isAllowedParentOrigin(referrerOrigin) ? referrerOrigin : null;
  } catch {
    return null;
  }
}

export function detectParentOrigin(
  loc: Pick<Location, "ancestorOrigins"> = location,
  doc: Pick<Document, "referrer"> = document,
): string | null {
  return resolveParentOrigin({
    ancestorOrigin: loc.ancestorOrigins[0] ?? "",
    referrer: doc.referrer,
  });
}
