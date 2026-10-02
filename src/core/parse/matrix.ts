import { emptyModel, type GraphModel, type MatrixCell } from "../types.js";
import { isArray, isNestedArray, isStringGrid, scalarText, type LCValue } from "./value.js";

const FALSY = new Set(["0", "", ".", "false", "null"]);

export function parseMatrix(value: LCValue, title?: string, showIndices = true): GraphModel {
  const model = emptyModel("matrix", title);
  model.directed = false;

  const grid = normalize(value);
  if (grid) model.matrix = { showIndices, rows: grid.map((row) => row.map(toCell)) };
  return model;
}

function toCell(raw: LCValue): MatrixCell {
  const text = scalarText(raw);
  return { text, filled: !FALSY.has(text.toLowerCase()) };
}

function normalize(value: LCValue): LCValue[][] | null {
  if (isNestedArray(value)) return value;
  if (!isArray(value) || value.length === 0) return null;
  if (isStringGrid(value)) return value.map((row) => [...row]);
  return value.every((v) => !isArray(v)) ? [value] : null;
}
