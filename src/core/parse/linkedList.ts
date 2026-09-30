import { emptyModel, type GraphModel, type Links } from "../types.js";
import { isArray, scalarText, type LCValue } from "./value.js";

export interface LinkedListOptions {
  cyclePos?: number;
  title?: string;
}

export function parseLinkedLists(
  lists: readonly LCValue[],
  options: LinkedListOptions,
  paneId: string,
): GraphModel {
  const links: Links = {};
  const listGroups: string[][] = [];
  const model: GraphModel = { ...emptyModel("linked-list", options.title), links, listGroups };
  let offset = 0;

  lists.forEach((list, listIndex) => {
    if (!isArray(list) || list.length === 0) return;
    const group = list.map((_, i) => `${paneId}${offset + i}`);

    list.forEach((raw, i) => {
      const id = group[i]!;
      const next = group[i + 1];
      model.nodes.push({ id, label: scalarText(raw), role: i === 0 ? "root" : "normal" });
      links[id] = next ? { next } : {};
    });

    const pos = listIndex === 0 ? options.cyclePos : undefined;
    const target = pos !== undefined && Number.isInteger(pos) && pos >= 0 ? group[pos] : undefined;
    if (target) links[group[group.length - 1]!] = { next: target };

    listGroups.push(group);
    offset += list.length;
  });

  return model;
}
