import { emptyModel, type GNode, type GraphModel } from "../types.js";
import { isArray, scalarText, type LCValue } from "./value.js";

interface Slot {
  id: string;
  left?: string;
  right?: string;
  depth: number;
}

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
  const model = emptyModel("binary-tree", title);
  if (!isArray(value)) {
    model.notes.push("Expected a level-order array.");
    return model;
  }
  if (value.length === 0 || value[0] === null) {
    model.notes.push("Empty tree.");
    return model;
  }

  const slots = new Map<string, Slot>();
  const byDepth = new Map<number, string[]>();

  const addNode = (id: string, label: string, depth: number, role: GNode["role"]) => {
    model.nodes.push({ id, label, role });
    slots.set(id, { id, depth });
    const level = byDepth.get(depth) ?? [];
    level.push(id);
    byDepth.set(depth, level);
  };

  addNode("n0", scalarText(value[0]!), 0, "root");

  const queue: string[] = ["n0"];
  let cursor = 1;
  let head = 0;

  while (head < queue.length && cursor < value.length) {
    const parentId = queue[head++]!;
    const parent = slots.get(parentId)!;

    for (const side of ["left", "right"] as const) {
      if (cursor >= value.length) break;
      const raw = value[cursor];
      const childId = `n${cursor}`;
      cursor += 1;
      if (raw === null || raw === undefined) continue;

      addNode(childId, scalarText(raw), parent.depth + 1, "normal");
      model.edges.push({ from: parentId, to: childId, role: "normal" });
      parent[side] = childId;
      queue.push(childId);
    }
  }

  addOrderingScaffold(model, slots, byDepth);
  buildRanks(model, byDepth);
  return model;
}

function addOrderingScaffold(
  model: GraphModel,
  slots: Map<string, Slot>,
  byDepth: Map<number, string[]>,
): void {
  for (const slot of slots.values()) {
    const { left, right } = slot;
    if (!left && !right) continue;

    const childDepth = slot.depth + 1;
    const level = byDepth.get(childDepth) ?? [];
    byDepth.set(childDepth, level);

    const spineId = `s_${slot.id}`;
    model.nodes.push({ id: spineId, label: "", role: "spine" });
    model.edges.push({ from: slot.id, to: spineId, role: "spine" });

    const leftId = left ?? addAnchor(model, `${slot.id}_L`, level);
    const rightId = right ?? addAnchor(model, `${slot.id}_R`, level);
    if (!left) model.edges.push({ from: slot.id, to: leftId, role: "null" });
    if (!right) model.edges.push({ from: slot.id, to: rightId, role: "null" });

    level.push(spineId);
    model.ranks.push({ ids: [leftId, spineId, rightId] });
    // Re-emit edges in left, spine, right order so `ordering=out` places them.
    reorderChildEdges(model, slot.id, [leftId, spineId, rightId]);
  }
}

function addAnchor(model: GraphModel, id: string, level: string[]): string {
  model.nodes.push({ id, label: "", role: "null" });
  level.push(id);
  return id;
}

/** `ordering=out` respects edge declaration order, so sort a node's out-edges. */
function reorderChildEdges(model: GraphModel, parentId: string, order: string[]): void {
  const rank = new Map(order.map((id, i) => [id, i]));
  const mine: number[] = [];
  model.edges.forEach((edge, i) => {
    if (edge.from === parentId) mine.push(i);
  });
  const sorted = mine
    .map((i) => model.edges[i]!)
    .sort((a, b) => (rank.get(a.to) ?? 99) - (rank.get(b.to) ?? 99));
  mine.forEach((slotIndex, k) => {
    model.edges[slotIndex] = sorted[k]!;
  });
}

function buildRanks(model: GraphModel, byDepth: Map<number, string[]>): void {
  for (const ids of byDepth.values()) {
    if (ids.length > 1) model.ranks.push({ ids: [...ids] });
  }
}
