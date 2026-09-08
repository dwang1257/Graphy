import { emptyModel, type GNode, type GraphModel } from "./types.js";
import { reachableIds, type TreeLinks } from "./topology.js";

interface Slot {
  id: string;
  left?: string;
  right?: string;
  depth: number;
}

/**
 * Builds a binary-tree GraphModel from stable nodes + child pointers.
 * Reuses the same left/right ordering scaffold as the original parser.
 */
export function modelFromTree(
  nodes: GNode[],
  links: TreeLinks,
  title?: string,
): GraphModel {
  const model = emptyModel("binary-tree", title);
  if (nodes.length === 0) {
    return model;
  }

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const slots = new Map<string, Slot>();
  const byDepth = new Map<number, string[]>();

  const addVisible = (id: string, depth: number) => {
    const source = byId.get(id);
    if (!source || slots.has(id)) return;
    model.nodes.push({
      id,
      label: source.label,
      role: depth === 0 ? "root" : "normal",
    });
    slots.set(id, { id, depth });
    const level = byDepth.get(depth) ?? [];
    level.push(id);
    byDepth.set(depth, level);
  };

  const rootId = nodes.find((n) => n.role === "root")?.id ?? nodes[0]!.id;
  const queue: string[] = [rootId];
  addVisible(rootId, 0);

  while (queue.length > 0) {
    const parentId = queue.shift()!;
    const parent = slots.get(parentId);
    if (!parent) continue;
    const kids = links[parentId] ?? {};
    for (const side of ["left", "right"] as const) {
      const childId = kids[side];
      if (!childId || !byId.has(childId)) continue;
      parent[side] = childId;
      if (!slots.has(childId)) {
        addVisible(childId, parent.depth + 1);
        queue.push(childId);
      }
      model.edges.push({ from: parentId, to: childId, role: "normal" });
    }
  }

  // Only keep links for nodes that made it into the model.
  const trimmed: TreeLinks = {};
  for (const id of slots.keys()) {
    const entry = links[id] ?? {};
    trimmed[id] = {
      ...(entry.left && slots.has(entry.left) ? { left: entry.left } : {}),
      ...(entry.right && slots.has(entry.right) ? { right: entry.right } : {}),
    };
  }
  model.links = trimmed;
  addOrderingScaffold(model, slots, byDepth);
  buildRanks(model, byDepth);
  return model;
}

/** Rebuilds a tree model from a topology snapshot, keeping base labels. */
export function applyTopology(base: GraphModel, links: TreeLinks): GraphModel {
  const live = reachableIds(links);
  const nodes = base.nodes.filter(
    (n) => (n.role === "root" || n.role === "normal") && live.has(n.id),
  );
  return modelFromTree(nodes, links, base.title);
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
    reorderChildEdges(model, slot.id, [leftId, spineId, rightId]);
  }
}

function addAnchor(model: GraphModel, id: string, level: string[]): string {
  model.nodes.push({ id, label: "", role: "null" });
  level.push(id);
  return id;
}

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
