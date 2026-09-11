import { applyListTopology } from "./parse/linkedList.js";
import { emptyModel, type GNode, type GraphModel } from "./types.js";
import { reachableIds, type TreeLinks } from "./topology.js";

interface Slot {
  left?: string;
  right?: string;
  depth: number;
}

export function modelFromTree(
  nodes: GNode[],
  links: TreeLinks,
  title?: string,
): GraphModel {
  const model = emptyModel("binary-tree", title);
  if (nodes.length === 0) return model;

  const byId = new Map(nodes.map((n) => [n.id, n]));
  const slots = new Map<string, Slot>();
  const byDepth = new Map<number, string[]>();

  function addVisible(id: string, depth: number): void {
    const source = byId.get(id);
    if (!source || slots.has(id)) return;
    model.nodes.push({
      id,
      label: source.label,
      role: depth === 0 ? "root" : "normal",
    });
    slots.set(id, { depth });
    levelAt(byDepth, depth).push(id);
  }

  const rootId = nodes.find((n) => n.role === "root")?.id ?? nodes[0]!.id;
  addVisible(rootId, 0);
  const queue = [rootId];

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

  const trimmed: TreeLinks = {};
  for (const id of slots.keys()) {
    const { left, right } = links[id] ?? {};
    trimmed[id] = {
      ...(left && slots.has(left) ? { left } : {}),
      ...(right && slots.has(right) ? { right } : {}),
    };
  }
  model.links = trimmed;
  addOrderingScaffold(model, slots, byDepth);
  buildRanks(model, byDepth);
  return model;
}

export function applyTopology(base: GraphModel, links: TreeLinks): GraphModel {
  if (base.kind === "linked-list") return applyListTopology(base, links);
  const live = reachableIds(links);
  const nodes = base.nodes.filter(
    (n) => (n.role === "root" || n.role === "normal") && live.has(n.id),
  );
  return modelFromTree(nodes, links, base.title);
}

function levelAt(byDepth: Map<number, string[]>, depth: number): string[] {
  const level = byDepth.get(depth) ?? [];
  byDepth.set(depth, level);
  return level;
}

function addOrderingScaffold(
  model: GraphModel,
  slots: Map<string, Slot>,
  byDepth: Map<number, string[]>,
): void {
  for (const [id, slot] of slots) {
    const { left, right } = slot;
    if (!left && !right) continue;

    const level = levelAt(byDepth, slot.depth + 1);
    const spineId = `s_${id}`;
    model.nodes.push({ id: spineId, label: "", role: "spine" });
    model.edges.push({ from: id, to: spineId, role: "spine" });

    const leftId = left ?? addAnchor(model, `${id}_L`, level);
    const rightId = right ?? addAnchor(model, `${id}_R`, level);
    if (!left) model.edges.push({ from: id, to: leftId, role: "null" });
    if (!right) model.edges.push({ from: id, to: rightId, role: "null" });

    level.push(spineId);
    model.ranks.push({ ids: [leftId, spineId, rightId] });
    reorderChildEdges(model, id, [leftId, spineId, rightId]);
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
  for (let i = 0; i < model.edges.length; i += 1) {
    if (model.edges[i]!.from === parentId) mine.push(i);
  }
  const sorted = mine
    .map((i) => model.edges[i]!)
    .sort((a, b) => (rank.get(a.to) ?? 99) - (rank.get(b.to) ?? 99));
  for (let k = 0; k < mine.length; k += 1) {
    model.edges[mine[k]!] = sorted[k]!;
  }
}

function buildRanks(model: GraphModel, byDepth: Map<number, string[]>): void {
  for (const ids of byDepth.values()) {
    if (ids.length > 1) model.ranks.push({ ids: [...ids] });
  }
}
