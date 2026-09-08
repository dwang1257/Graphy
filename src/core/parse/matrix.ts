import { emptyModel, type GraphModel, type MatrixCell } from "../types.js";
import { isArray, isNestedArray, scalarText, type LCValue } from "./value.js";

const FALSY = new Set(["0", "", ".", "false", "null"]);

/**
 * Grids render as one Graphviz node carrying an HTML-like table label - cheaper
 * and far more legible than one node per cell with invisible alignment edges.
 */
export function parseMatrix(value: LCValue, title?: string, showIndices = true): GraphModel {
  const model = emptyModel("matrix", title);
  model.directed = false;

  const grid = normalize(value);
  if (!grid || grid.length === 0) {
    return model;
  }

  model.matrix = {
    showIndices,
    rows: grid.map((row) => row.map(toCell)),
  };
  return model;
}

function toCell(raw: LCValue): MatrixCell {
  const text = scalarText(raw);
  return { text, filled: !FALSY.has(text.toLowerCase()) };
}

/** Accepts `[[..]]` directly, expands string grids, and promotes other flat arrays. */
function normalize(value: LCValue): LCValue[][] | null {
  if (isNestedArray(value)) return value;
  if (isArray(value)) {
    if (value.length === 0) return [];
    if (
      value.every((v): v is string => typeof v === "string") &&
      value[0]!.length > 0 &&
      value.every((v) => v.length === value[0]!.length)
    ) {
      return value.map((row) => [...row]);
    }
    if (value.every((v) => !isArray(v))) return [value];
  }
  return null;
}
