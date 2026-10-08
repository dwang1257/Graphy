import type { GEdge, GNode, GraphModel, Links, NodeLinks, Pane, StructureKind } from "./types.js";

export type NodeKind = "tree" | "list";

export interface SceneNode {
  id: string;
  kind: NodeKind;
  label: string;
  root: boolean;
}

export interface SceneTopology {
  order: readonly string[];
  nodes: Readonly<Record<string, SceneNode>>;
  links: Readonly<Links>;
  deleted: ReadonlySet<string>;
}

export interface SceneOptions {
  showTerminal: boolean;
}

export interface LooseEdge extends GEdge {
  constraint: false;
}

export function gridNodeId(pane: string): string {
  return `${pane}_grid`;
}

export function gridPaneOf(id: string): string | undefined {
  return /^([a-y])_grid$/.exec(id)?.[1];
}

export function cellId(pane: string, r: number, c: number): string {
  return `${pane}${r}.${c}`;
}

function kindOf(kind: StructureKind): NodeKind | undefined {
  if (kind === "binary-tree") return "tree";
  if (kind === "linked-list") return "list";
  return undefined;
}

export function initialTopology(panes: readonly Pane[]): SceneTopology {
  const order: string[] = [];
  const nodes: Record<string, SceneNode> = {};
  const links: Links = {};
  for (const pane of panes) {
    const kind = kindOf(pane.model.kind);
    if (!kind) continue;
    for (const node of pane.model.nodes) {
      if (node.role !== "root" && node.role !== "normal") continue;
      if (nodes[node.id]) continue;
      order.push(node.id);
      nodes[node.id] = { id: node.id, kind, label: node.label, root: node.role === "root" };
      links[node.id] = { ...(pane.model.links?.[node.id] ?? {}) };
    }
  }
  return { order, nodes, links, deleted: new Set() };
}

export function childrenOf(kind: NodeKind, links: NodeLinks | undefined): string[] {
  if (!links) return [];
  if (kind === "list") return links.next ? [links.next] : [];
  const out: string[] = [];
  if (links.left) out.push(links.left);
  if (links.right) out.push(links.right);
  return out;
}

export function visibleIds(topology: SceneTopology): string[] {
  return topology.order.filter((id) => !topology.deleted.has(id) && topology.nodes[id] !== undefined);
}

export function layoutKeyOf(topology: SceneTopology): string {
  const visible = new Set(visibleIds(topology));
  const parts: string[] = [];
  for (const id of visible) {
    const node = topology.nodes[id]!;
    const links = topology.links[id] ?? {};
    const show = (target: string | undefined): string => (target && visible.has(target) ? target : "");
    const edges = node.kind === "list" ? show(links.next) : `${show(links.left)},${show(links.right)}`;
    parts.push(`${id}:${node.label}:${edges}`);
  }
  return parts.join("|");
}

interface Slot {
  left?: string;
  right?: string;
  depth: number;
}

interface Build {
  topology: SceneTopology;
  visible: Set<string>;
  model: GraphModel;
  placed: Set<string>;
  slots: Map<string, Slot>;
  byDepth: Map<number, string[]>;
  titles: Map<string, string>;
  showTerminal: boolean;
  lastRowHead?: string;
}

function levelAt(byDepth: Map<number, string[]>, depth: number): string[] {
  const level = byDepth.get(depth) ?? [];
  byDepth.set(depth, level);
  return level;
}

function paneOf(id: string): string {
  return id.charAt(0);
}

function loose(from: string, to: string): LooseEdge {
  return { from, to, role: "normal", constraint: false };
}

function titleFor(build: Build, pane: string, target: string): string | undefined {
  const title = build.titles.get(pane);
  if (title === undefined) return undefined;
  build.titles.delete(pane);
  const id = `t_${pane}`;
  build.model.nodes.push({ id, label: title, role: "title" });
  build.model.edges.push({ from: id, to: target, role: "spine" });
  return id;
}

function addTitle(build: Build, head: string): string | undefined {
  if (!build.topology.nodes[head]?.root) return undefined;
  return titleFor(build, paneOf(head), head);
}

function placeTree(build: Build, head: string): void {
  const { model, topology, visible, placed, slots, byDepth } = build;
  addTitle(build, head);

  const add = (id: string, depth: number): void => {
    const node = topology.nodes[id]!;
    model.nodes.push({ id, label: node.label, role: node.root ? "root" : "normal" });
    placed.add(id);
    slots.set(id, { depth });
    levelAt(byDepth, depth).push(id);
  };

  add(head, 0);
  const queue = [head];
  let cursor = 0;
  while (cursor < queue.length) {
    const parentId = queue[cursor++]!;
    const parent = slots.get(parentId)!;
    const links = topology.links[parentId] ?? {};
    for (const side of ["left", "right"] as const) {
      const childId = links[side];
      if (!childId || !visible.has(childId) || topology.nodes[childId]?.kind !== "tree") continue;
      if (placed.has(childId)) {
        model.edges.push({ from: parentId, to: childId, role: "cycle" });
        continue;
      }
      parent[side] = childId;
      add(childId, parent.depth + 1);
      queue.push(childId);
      model.edges.push({ from: parentId, to: childId, role: "normal" });
    }
  }
}

function placeRow(build: Build, head: string): void {
  const { model, topology, visible, placed } = build;
  const title = addTitle(build, head);
  const row: string[] = title ? [title] : [];
  const inRow = new Set<string>();
  let current = head;
  for (;;) {
    const node = topology.nodes[current]!;
    model.nodes.push({ id: current, label: node.label, role: node.root ? "root" : "normal" });
    placed.add(current);
    inRow.add(current);
    row.push(current);
    const next = topology.links[current]?.next;
    if (!next) {
      if (build.showTerminal) {
        const terminal = `${current}~`;
        model.nodes.push({ id: terminal, label: "∅", role: "terminal" });
        model.edges.push({ from: current, to: terminal, role: "normal" });
        row.push(terminal);
      }
      break;
    }
    if (!visible.has(next) || topology.nodes[next]?.kind !== "list") break;
    if (placed.has(next)) {
      model.edges.push(inRow.has(next) ? { from: current, to: next, role: "cycle" } : loose(current, next));
      break;
    }
    model.edges.push({ from: current, to: next, role: "normal" });
    current = next;
  }
  chainRow(build, head, row);
}

function chainRow(build: Build, head: string, row: string[]): void {
  build.model.ranks.push({ ids: row });
  if (build.lastRowHead) build.model.edges.push({ from: build.lastRowHead, to: head, role: "spine" });
  build.lastRowHead = head;
}

function placeEmpty(build: Build, pane: string): string[] {
  const id = `${pane}_empty`;
  build.model.nodes.push({ id, label: "∅", role: "terminal" });
  const title = titleFor(build, pane, id);
  return title ? [title, id] : [id];
}

function addScaffold(build: Build): void {
  const { model, slots, byDepth } = build;
  for (const [id, slot] of slots) {
    const { left, right } = slot;
    if (!left && !right) continue;
    const level = levelAt(byDepth, slot.depth + 1);
    const spineId = `s_${id}`;
    model.nodes.push({ id: spineId, label: "", role: "spine" });
    model.edges.push({ from: id, to: spineId, role: "spine" });
    const anchor = (anchorId: string): string => {
      model.nodes.push({ id: anchorId, label: "", role: "null" });
      level.push(anchorId);
      model.edges.push({ from: id, to: anchorId, role: "null" });
      return anchorId;
    };
    const leftId = left ?? anchor(`${id}_L`);
    const rightId = right ?? anchor(`${id}_R`);
    level.push(spineId);
    model.ranks.push({ ids: [leftId, spineId, rightId] });
    reorderChildEdges(model, id, [leftId, spineId, rightId]);
  }
  for (const ids of byDepth.values()) {
    if (ids.length > 1) model.ranks.push({ ids: [...ids] });
  }
}

function reorderChildEdges(model: GraphModel, parentId: string, order: string[]): void {
  const rank = new Map(order.map((id, i) => [id, i]));
  const mine: number[] = [];
  model.edges.forEach((edge, i) => {
    if (edge.from === parentId && edge.role !== "cycle") mine.push(i);
  });
  const sorted = mine
    .map((i) => model.edges[i]!)
    .sort((a, b) => (rank.get(a.to) ?? 99) - (rank.get(b.to) ?? 99));
  mine.forEach((index, k) => {
    model.edges[index] = sorted[k]!;
  });
}

function firstRoot(
  topology: SceneTopology,
  visible: Set<string>,
  position: Map<string, number>,
  head: string,
): number {
  const kind = topology.nodes[head]!.kind;
  const seen = new Set<string>();
  const stack = [head];
  let best = Number.POSITIVE_INFINITY;
  while (stack.length > 0) {
    const id = stack.pop()!;
    const node = topology.nodes[id];
    if (seen.has(id) || !node || node.kind !== kind || !visible.has(id)) continue;
    seen.add(id);
    if (node.root) best = Math.min(best, position.get(id) ?? best);
    stack.push(...childrenOf(kind, topology.links[id]));
  }
  return best;
}

function headRank(node: SceneNode): number {
  if (node.root) return 0;
  return node.id.startsWith("z") ? 2 : 1;
}

function sceneKind(topology: SceneTopology, visible: Set<string>, panes: readonly Pane[]): StructureKind {
  let list = false;
  for (const id of visible) {
    const kind = topology.nodes[id]?.kind;
    if (kind === "tree") return "binary-tree";
    if (kind === "list") list = true;
  }
  if (list) return "linked-list";
  if (panes.some((pane) => pane.model.kind === "graph")) return "graph";
  return panes.find((pane) => pane.model.kind === "matrix") ? "matrix" : panes[0]?.model.kind ?? "binary-tree";
}

function isEmptyPane(pane: Pane): boolean {
  if (pane.model.kind === "matrix") return !pane.model.matrix || pane.model.matrix.rows.length === 0;
  if (pane.model.kind === "graph") return pane.model.nodes.length === 0;
  return !pane.model.nodes.some((node) => node.role === "root" || node.role === "normal");
}

export function sceneModel(
  panes: readonly Pane[],
  topology: SceneTopology,
  options: SceneOptions,
): GraphModel {
  const visible = new Set(visibleIds(topology));
  const model: GraphModel = {
    kind: sceneKind(topology, visible, panes),
    directed: true,
    nodes: [],
    edges: [],
    ranks: [],
  };
  const build: Build = {
    topology,
    visible,
    model,
    placed: new Set(),
    slots: new Map(),
    byDepth: new Map(),
    titles: new Map(),
    showTerminal: options.showTerminal,
  };

  const incoming = new Set<string>();
  for (const id of visible) {
    const node = topology.nodes[id]!;
    for (const child of childrenOf(node.kind, topology.links[id])) {
      if (visible.has(child) && topology.nodes[child]?.kind === node.kind) incoming.add(child);
    }
  }
  const position = new Map(topology.order.map((id, i) => [id, i]));
  const heads = [...visible].filter((id) => !incoming.has(id));
  const anchor = new Map(heads.map((id) => [id, firstRoot(topology, visible, position, id)]));
  heads.sort((a, b) =>
    anchor.get(a)! - anchor.get(b)!
    || headRank(topology.nodes[a]!) - headRank(topology.nodes[b]!)
    || position.get(a)! - position.get(b)!);

  const headedPanes = new Set(heads.filter((id) => topology.nodes[id]!.root).map(paneOf));
  const grids = panes.filter((pane) => pane.model.kind === "matrix" && !isEmptyPane(pane));
  const graphs = panes.filter((pane) => pane.model.kind === "graph" && !isEmptyPane(pane));
  const empties = panes.filter((pane) => pane.model.kind !== "matrix" && isEmptyPane(pane));
  const components = headedPanes.size + grids.length + graphs.length + empties.length;
  if (components >= 2) {
    for (const pane of panes) build.titles.set(pane.id, pane.title);
  }

  const place = (id: string): void => {
    if (build.placed.has(id)) return;
    if (topology.nodes[id]!.kind === "tree") placeTree(build, id);
    else placeRow(build, id);
  };
  const emptyRows = empties.filter((pane) => components >= 2 && pane.model.kind === "linked-list").map((pane) => pane.id);
  const placeEmptyRow = (pane: string): void => chainRow(build, `${pane}_empty`, placeEmpty(build, pane));
  for (const id of heads) {
    while (emptyRows[0] !== undefined && emptyRows[0] < paneOf(id)) placeEmptyRow(emptyRows.shift()!);
    place(id);
  }
  for (const id of visible) place(id);
  emptyRows.forEach(placeEmptyRow);
  addScaffold(build);

  for (const pane of grids) {
    const id = gridNodeId(pane.id);
    const node: GNode = { id, label: "", role: "normal", matrix: pane.model.matrix };
    model.nodes.push(node);
    titleFor(build, pane.id, id);
  }

  if (graphs.length > 0 && visible.size === 0 && grids.length === 0 && graphs.every((pane) => !pane.model.directed)) {
    model.engine = "neato";
  }
  for (const pane of graphs) {
    model.nodes.push(...pane.model.nodes.map((node) => ({ ...node })));
    model.edges.push(...pane.model.edges.map((edge) => ({ ...edge })));
    const first = pane.model.nodes[0];
    if (first) titleFor(build, pane.id, first.id);
  }

  if (components >= 2) {
    for (const pane of empties) {
      if (pane.model.kind !== "linked-list") placeEmpty(build, pane.id);
    }
  }

  return model;
}
