import type { TreeLinks } from "../topology.js";
import { emptyModel, type GNode, type GraphModel } from "../types.js";
import { isArray, scalarText, type LCValue } from "./value.js";

export const MAX_LINKED_LISTS = 3;

export interface LinkedListOptions {
  cyclePos?: number;
  showTerminal?: boolean;
}

export interface LinkedListInput {
  value: LCValue;
  title?: string;
}

function isLive(node: GNode): boolean {
  return node.role === "root" || node.role === "normal";
}

export function parseLinkedList(
  value: LCValue,
  title?: string,
  options: LinkedListOptions = {},
): GraphModel {
  return parseLinkedLists([{ value, title }], options);
}

export function parseLinkedLists(
  lists: LinkedListInput[],
  options: LinkedListOptions = {},
): GraphModel {
  const chains = lists
    .filter((list) => isArray(list.value) && list.value.length > 0)
    .slice(0, MAX_LINKED_LISTS);
  const title = chains.map((list) => list.title).filter(Boolean).join(" · ") || undefined;
  const model = emptyModel("linked-list", title);
  if (chains.length === 0) return model;

  const links: TreeLinks = {};
  const listGroups: string[][] = [];
  let offset = 0;

  chains.forEach((list, listIndex) => {
    const value = list.value as LCValue[];
    const group = value.map((_, i) => `n${offset + i}`);
    const last = group[group.length - 1]!;
    const pos = listIndex === 0 ? (options.cyclePos ?? -1) : -1;

    value.forEach((raw, i) => {
      const id = group[i]!;
      model.nodes.push({ id, label: scalarText(raw), role: i === 0 ? "root" : "normal" });
      if (i > 0) model.edges.push({ from: group[i - 1]!, to: id, role: "normal" });
      links[id] = i + 1 < value.length ? { left: group[i + 1]! } : {};
    });

    const rankIds = [...group];
    if (pos >= 0 && pos < value.length) {
      const target = group[pos]!;
      model.edges.push({ from: last, to: target, role: "cycle" });
      links[last] = { left: target };
    } else if (options.showTerminal !== false) {
      const terminalId = chains.length > 1 ? `tail${listIndex}` : "tail";
      model.nodes.push({ id: terminalId, label: "∅", role: "terminal" });
      model.edges.push({ from: last, to: terminalId, role: "normal" });
      rankIds.push(terminalId);
    }

    if (listIndex > 0) {
      model.edges.push({ from: listGroups[listIndex - 1]![0]!, to: group[0]!, role: "spine" });
    }

    model.ranks.push({ ids: rankIds });
    listGroups.push(group);
    offset += value.length;
  });

  model.links = links;
  model.listGroups = listGroups;
  return model;
}

export function withListAllocs(base: GraphModel, allocs: GNode[] | undefined): GraphModel {
  if (!allocs?.length) return base;
  const have = new Set(base.nodes.map((n) => n.id));
  const fresh = allocs.filter((n) => !have.has(n.id));
  if (fresh.length === 0) return base;

  const groups = base.listGroups?.length
    ? base.listGroups.map((group) => [...group])
    : [base.nodes.filter(isLive).map((n) => n.id)];
  const extra = fresh.map((n) => n.id);
  if (groups.length < MAX_LINKED_LISTS) groups.push(extra);
  else groups[MAX_LINKED_LISTS - 1] = [...(groups[MAX_LINKED_LISTS - 1] ?? []), ...extra];

  return { ...base, nodes: [...base.nodes, ...fresh], listGroups: groups };
}

function groupsOf(base: GraphModel, live: GNode[]): string[][] {
  const ids = live.map((n) => n.id);
  if (!base.listGroups?.length) return [ids];
  const liveSet = new Set(ids);
  const known = new Set(base.listGroups.flat());
  const groups = base.listGroups
    .map((group) => group.filter((id) => liveSet.has(id)))
    .filter((group) => group.length > 0);
  const extra = ids.filter((id) => !known.has(id));
  if (extra.length > 0) groups.push(extra);
  if (groups.length > MAX_LINKED_LISTS) {
    groups.push(groups.splice(MAX_LINKED_LISTS - 1).flat());
  }
  return groups;
}

function createsCycle(links: TreeLinks, from: string, to: string): boolean {
  const seen = new Set<string>();
  for (let cur: string | undefined = to; cur && !seen.has(cur); cur = links[cur]?.left) {
    if (cur === from) return true;
    seen.add(cur);
  }
  return false;
}

function tailIdFor(tails: GNode[], groupCount: number, index: number): string | undefined {
  if (tails.length === 0) return undefined;
  return groupCount === 1 ? tails[0]?.id : (tails[index]?.id ?? `tail${index}`);
}

export function applyListTopology(base: GraphModel, links: TreeLinks): GraphModel {
  const model = emptyModel("linked-list", base.title);
  const live = base.nodes.filter(isLive);
  model.nodes = live.map(({ id, label, role }) => ({ id, label, role }));
  const idSet = new Set(live.map((n) => n.id));
  const groups = groupsOf(base, live);
  model.listGroups = groups;
  const tails = base.nodes.filter((n) => n.role === "terminal");
  const tailIds = groups.map((_, i) => tailIdFor(tails, groups.length, i));
  const have = new Set(idSet);

  for (const node of live) {
    const next = links[node.id]?.left;
    if (next && idSet.has(next)) {
      model.edges.push({
        from: node.id,
        to: next,
        role: createsCycle(links, node.id, next) ? "cycle" : "normal",
      });
    }
  }

  groups.forEach((group, i) => {
    const tailId = tailIds[i];
    if (!tailId) return;
    if (!have.has(tailId)) {
      model.nodes.push({ id: tailId, label: "∅", role: "terminal" });
      have.add(tailId);
    }
    for (const id of group) {
      const next = links[id]?.left;
      if (!next || !idSet.has(next)) {
        model.edges.push({ from: id, to: tailId, role: "normal" });
      }
    }
  });

  groups.forEach((group, i) => {
    const tailId = tailIds[i];
    model.ranks.push({ ids: tailId ? [...group, tailId] : [...group] });
    const prev = groups[i - 1]?.[0];
    if (prev && group[0]) model.edges.push({ from: prev, to: group[0], role: "spine" });
  });

  model.links = links;
  return model;
}
