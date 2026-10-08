import { emptyModel, type GEdge, type GraphModel } from "../types.js";
import { isArray, isNestedArray, scalarText, type LCValue } from "./value.js";

export const DIRECTED_EDGE_NAMES = [
  "prerequisites", "times", "flights", "trust", "tickets", "relations", "redEdges", "blueEdges", "paths",
] as const;
export const EDGE_NAMES = [...DIRECTED_EDGE_NAMES, "edges", "connections", "dislikes", "roads", "adjacentPairs", "equations"] as const;
export const ADJACENCY_NAMES = ["graph", "rooms", "adjList", "adjacencyList"] as const;
export const MATRIX_GRAPH_NAMES = ["isConnected"] as const;
export const GRAPH_NAMES = [...EDGE_NAMES, ...ADJACENCY_NAMES, ...MATRIX_GRAPH_NAMES] as const;
export const COUNT_NAMES = ["n", "numCourses", "numNodes", "N"] as const;

export type GraphForm = "edges" | "adjacency" | "matrix";

export interface GraphOptions {
  title?: string;
  name?: string;
  type?: string;
  count?: number;
}

const NODE_TYPE = /\bNode\b/;

function has(names: readonly string[], name: string | undefined): boolean {
  return name !== undefined && names.includes(name);
}

export function graphLabel(text: string): string {
  return text.replace(/[\t\n\v\f\r ,]/g, "_").slice(0, 12);
}

function isIndex(v: LCValue, size: number): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= size;
}

function isIndexRows(value: LCValue[][]): boolean {
  return value.every((row) => row.every((v) => isIndex(v, value.length)));
}

export function isAdjacencyList(value: LCValue): boolean {
  if (!isNestedArray(value) || value.length < 2) return false;
  return new Set(value.map((row) => row.length)).size > 1 && isIndexRows(value);
}

function isSquareBinary(value: LCValue[][]): boolean {
  return value.length > 0 && value.every((row) => row.length === value.length && row.every((v) => v === 0 || v === 1));
}

function isEdgeRows(value: LCValue[][]): boolean {
  const width = value[0]?.length ?? 2;
  return (width === 2 || width === 3) && value.every((row) => row.length === width && row.every((v) => !isArray(v) && v !== null));
}

export function isGraphParam(name: string | undefined, type = ""): boolean {
  return has(GRAPH_NAMES, name) || NODE_TYPE.test(type);
}

export function graphForm(value: LCValue, options: GraphOptions = {}): GraphForm | undefined {
  if (value === null) return "adjacency";
  if (!isArray(value)) return undefined;
  if (value.length === 0) return has(EDGE_NAMES, options.name) ? "edges" : "adjacency";
  if (!isNestedArray(value)) return undefined;
  if (NODE_TYPE.test(options.type ?? "")) return "adjacency";
  if (has(EDGE_NAMES, options.name)) return isEdgeRows(value) ? "edges" : undefined;
  const matrix = isSquareBinary(value) && value.every((row, i) => row[i] === value[0]?.[0]);
  if (has(MATRIX_GRAPH_NAMES, options.name)) return isSquareBinary(value) ? "matrix" : undefined;
  if (has(ADJACENCY_NAMES, options.name)) {
    if (matrix) return "matrix";
    return isIndexRows(value) ? "adjacency" : undefined;
  }
  if (matrix) return "matrix";
  if (isAdjacencyList(value)) return "adjacency";
  if (isEdgeRows(value)) return "edges";
  return isIndexRows(value) ? "adjacency" : undefined;
}

export function graphNodeCount(value: LCValue, options: GraphOptions = {}): number {
  return parseGraph(value, "a", options).nodes.length;
}

interface Builder {
  model: GraphModel;
  ids: Map<string, string>;
  seen: Set<string>;
  paneId: string;
}

function node(build: Builder, raw: LCValue): string {
  const label = scalarText(raw);
  const known = build.ids.get(label);
  if (known) return known;
  const id = `${build.paneId}${build.model.nodes.length}`;
  build.ids.set(label, id);
  build.model.nodes.push({ id, label, role: "normal" });
  return id;
}

function edge(build: Builder, from: string, to: string, label?: string): void {
  const directed = build.model.directed;
  const key = directed || from <= to ? `${from}>${to}` : `${to}>${from}`;
  if (build.seen.has(key)) return;
  build.seen.add(key);
  const entry: GEdge = { from, to, role: "normal" };
  if (label !== undefined) entry.label = label;
  if (!directed) entry.undirected = true;
  build.model.edges.push(entry);
}

function symmetric(pairs: ReadonlyArray<readonly [number, number]>): boolean {
  const set = new Set(pairs.map(([a, b]) => `${a},${b}`));
  return pairs.every(([a, b]) => set.has(`${b},${a}`));
}

function edgeLabels(rows: LCValue[][], count: number | undefined): LCValue[] {
  const ends = rows.flatMap((row) => row.slice(0, 2));
  if (count === undefined || !Number.isInteger(count) || count < 0) {
    const unique = [...new Map(ends.map((v) => [scalarText(v), v])).values()];
    return unique.every((v) => typeof v === "number") ? (unique as number[]).sort((a, b) => a - b) : unique;
  }
  const base = ends.some((v) => v === count) ? 1 : 0;
  return [...Array.from({ length: count }, (_, i) => i + base), ...ends];
}

export function parseGraph(value: LCValue, paneId: string, options: GraphOptions = {}): GraphModel {
  const model = emptyModel("graph", options.title);
  const build: Builder = { model, ids: new Map(), seen: new Set(), paneId };
  const form = graphForm(value, options);
  if (!form || !isArray(value)) {
    if (value !== null && value !== undefined) throw new Error(`${options.title ?? "Input"} is not a valid graph.`);
    return model;
  }
  const rows = value as LCValue[][];

  if (form === "edges") {
    model.directed = has(DIRECTED_EDGE_NAMES, options.name);
    for (const label of edgeLabels(rows, options.count)) node(build, label);
    for (const row of rows) {
      const weight = row.length > 2 ? scalarText(row[2] ?? null) : undefined;
      edge(build, node(build, row[0] ?? null), node(build, row[1] ?? null), weight);
    }
    return model;
  }

  const base = NODE_TYPE.test(options.type ?? "") ? 1 : 0;
  rows.forEach((_, i) => node(build, i + base));
  const pairs: Array<[number, number]> = [];
  rows.forEach((row, i) => {
    row.forEach((v, j) => {
      if (form === "matrix") {
        if (v === 1 && i !== j) pairs.push([i + base, j + base]);
      } else if (typeof v === "number") {
        pairs.push([i + base, v]);
      }
    });
  });
  model.directed = !symmetric(pairs);
  for (const [a, b] of pairs) edge(build, node(build, a), node(build, b));
  return model;
}
