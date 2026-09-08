/** Left/right child pointers keyed by stable Graphy node id. */
export type TreeLinks = Record<string, { left?: string; right?: string }>;

/** Parses `n0:n2,n1 n1:-,-` tokens into child pointers (`-` = None). */
export function parseTopologyTokens(raw: string): TreeLinks {
  const links: TreeLinks = {};
  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    const match = /^(n\d+):([^,]*),([^,]*)$/i.exec(token);
    if (!match) continue;
    const id = match[1]!.toLowerCase();
    const left = childRef(match[2]!);
    const right = childRef(match[3]!);
    const entry: { left?: string; right?: string } = {};
    if (left) entry.left = left;
    if (right) entry.right = right;
    links[id] = entry;
  }
  return links;
}

function childRef(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") return undefined;
  return trimmed.toLowerCase();
}

/** Ids reachable by walking left/right from `root`. */
export function reachableIds(links: TreeLinks, root = "n0"): Set<string> {
  const seen = new Set<string>();
  if (Object.keys(links).length === 0) return seen;
  const queue = [root];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const kids = links[id];
    if (!kids) continue;
    if (kids.left) queue.push(kids.left);
    if (kids.right) queue.push(kids.right);
  }
  return seen;
}

/** Base visible ids that are no longer reachable in `links`. Empty links = no tracking. */
export function deletedIds(baseIds: string[], links: TreeLinks): string[] {
  if (Object.keys(links).length === 0) return [];
  const live = reachableIds(links);
  return baseIds.filter((id) => !live.has(id));
}

/** Stable canonical string for hashing unique topologies. */
export function canonicalizeLinks(links: TreeLinks): string {
  return Object.keys(links)
    .sort()
    .map((id) => {
      const entry = links[id]!;
      return `${id}:${entry.left ?? "-"},${entry.right ?? "-"}`;
    })
    .join(" ");
}

