import { emptyModel, type GraphModel } from "../types.js";
import { isArray, scalarText, type LCValue } from "./value.js";

export interface LinkedListOptions {
  /** LeetCode's `pos` parameter: index the tail loops back to, -1 for none. */
  cyclePos?: number;
  showTerminal?: boolean;
}

export function parseLinkedList(
  value: LCValue,
  title?: string,
  options: LinkedListOptions = {},
): GraphModel {
  const model = emptyModel("linked-list", title);
  if (!isArray(value) || value.length === 0) {
    return model;
  }

  value.forEach((raw, i) => {
    model.nodes.push({ id: `n${i}`, label: scalarText(raw), role: i === 0 ? "root" : "normal" });
    if (i > 0) model.edges.push({ from: `n${i - 1}`, to: `n${i}`, role: "normal" });
  });

  const pos = options.cyclePos ?? -1;
  const last = value.length - 1;

  if (pos >= 0 && pos < value.length) {
    model.edges.push({ from: `n${last}`, to: `n${pos}`, role: "cycle" });
  } else if (options.showTerminal !== false) {
    model.nodes.push({ id: "tail", label: "∅", role: "terminal" });
    model.edges.push({ from: `n${last}`, to: "tail", role: "normal" });
  }

  // One rank keeps the list on a single horizontal line even with a cycle edge.
  model.ranks.push({ ids: model.nodes.map((n) => n.id) });
  return model;
}
