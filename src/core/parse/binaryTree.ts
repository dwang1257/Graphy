import { emptyModel, type GNode, type GraphModel } from "../types.js";
import { modelFromTree } from "../treeModel.js";
import type { TreeLinks } from "../topology.js";
import { isArray, scalarText, type LCValue } from "./value.js";

/**
 * Parses LeetCode level-order form (`[1,null,2,3]`) where children are only
 * enumerated for non-null parents.
 *
 * Graphviz `dot` does not preserve child order, and a lone right child would
 * render centered under its parent - indistinguishable from a left child. So
 * every node with exactly one child also gets an invisible anchor on the empty
 * side plus an invisible spine node, all pinned to the child's rank.
 */
export function parseBinaryTree(value: LCValue, title?: string): GraphModel {
  if (!isArray(value)) {
    return emptyModel("binary-tree", title);
  }
  if (value.length === 0 || value[0] === null) {
    return emptyModel("binary-tree", title);
  }

  const nodes: GNode[] = [];
  const links: TreeLinks = {};
  const labels = new Map<string, string>();

  const rootLabel = scalarText(value[0]!);
  nodes.push({ id: "n0", label: rootLabel, role: "root" });
  labels.set("n0", rootLabel);
  links.n0 = {};

  const queue: string[] = ["n0"];
  let cursor = 1;
  let head = 0;

  while (head < queue.length && cursor < value.length) {
    const parentId = queue[head++]!;
    const parentLinks = links[parentId] ?? (links[parentId] = {});

    for (const side of ["left", "right"] as const) {
      if (cursor >= value.length) break;
      const raw = value[cursor];
      const childId = `n${cursor}`;
      cursor += 1;
      if (raw === null || raw === undefined) continue;

      const label = scalarText(raw);
      nodes.push({ id: childId, label, role: "normal" });
      labels.set(childId, label);
      links[childId] = {};
      parentLinks[side] = childId;
      queue.push(childId);
    }
  }

  return modelFromTree(nodes, links, title);
}
