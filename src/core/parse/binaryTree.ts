import { emptyModel, type GraphModel, type Links } from "../types.js";
import { isArray, scalarText, type LCValue } from "./value.js";

export function parseBinaryTree(value: LCValue, title: string | undefined, paneId: string): GraphModel {
  const links: Links = {};
  const model: GraphModel = { ...emptyModel("binary-tree", title), links };
  if (!isArray(value) || value.length === 0) return model;

  let cursor = 1;
  const rootValue = value[0];
  if (rootValue !== undefined && rootValue !== null) {
    const rootId = `${paneId}0`;
    model.nodes.push({ id: rootId, label: scalarText(rootValue), role: "root" });
    links[rootId] = {};

    const queue: string[] = [rootId];
    let head = 0;
    while (head < queue.length && cursor < value.length) {
      const parentId = queue[head++]!;
      const parentLinks = links[parentId] ?? (links[parentId] = {});

      for (const side of ["left", "right"] as const) {
        if (cursor >= value.length) break;
        const raw = value[cursor];
        const childId = `${paneId}${cursor}`;
        cursor += 1;
        if (raw === null || raw === undefined) continue;

        model.nodes.push({ id: childId, label: scalarText(raw), role: "normal" });
        links[childId] = {};
        parentLinks[side] = childId;
        queue.push(childId);
      }
    }
  }

  if (value.slice(cursor).some((raw) => raw !== null)) {
    throw new Error("Binary-tree input contains an unreachable value.");
  }

  return model;
}
