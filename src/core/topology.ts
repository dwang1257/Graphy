export type TreeLinks = Record<string, { left?: string; right?: string }>;

export function supportsTopologyMorph(kind: string | undefined): boolean {
  return kind === "binary-tree" || kind === "linked-list";
}

export function parseTopologyTokens(raw: string): TreeLinks {
  const links: TreeLinks = {};
  for (const token of raw.trim().split(/\s+/).filter(Boolean)) {
    const match = /^(n\d+):([^,]*),([^,]*)$/i.exec(token);
    if (!match) continue;
    const left = childRef(match[2]!);
    const right = childRef(match[3]!);
    links[match[1]!.toLowerCase()] = {
      ...(left ? { left } : {}),
      ...(right ? { right } : {}),
    };
  }
  return links;
}

function childRef(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed || trimmed === "-") return undefined;
  return trimmed.toLowerCase();
}

export function reachableIds(links: TreeLinks, root = "n0"): Set<string> {
  const seen = new Set<string>();
  if (Object.keys(links).length === 0) return seen;
  const queue = [root];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const kids = links[id];
    if (kids?.left) queue.push(kids.left);
    if (kids?.right) queue.push(kids.right);
  }
  return seen;
}

export function deletedIds(baseIds: string[], links: TreeLinks): string[] {
  if (Object.keys(links).length === 0) return [];
  const live = reachableIds(links);
  return baseIds.filter((id) => !live.has(id));
}

export function canonicalizeLinks(links: TreeLinks): string {
  return Object.keys(links)
    .sort()
    .map((id) => {
      const entry = links[id]!;
      return `${id}:${entry.left ?? "-"},${entry.right ?? "-"}`;
    })
    .join(" ");
}
