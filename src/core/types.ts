import type { TreeLinks } from "./topology.js";

/** Structure kinds Graphy can visualize. */
export type StructureKind =
  | "binary-tree"
  | "linked-list"
  | "matrix";

export type NodeRole = "normal" | "null" | "spine" | "root" | "terminal";

export interface GNode {
  id: string;
  label: string;
  role: NodeRole;
}

export type EdgeRole = "normal" | "spine" | "null" | "cycle";

export interface GEdge {
  from: string;
  to: string;
  label?: string;
  role: EdgeRole;
}

export interface MatrixCell {
  text: string;
  /** Truthy cells get accent fill (land in grid problems, 1s in a bitmap). */
  filled: boolean;
}

export interface MatrixData {
  rows: MatrixCell[][];
  /** Renders row/column indices in a header gutter. */
  showIndices: boolean;
}

export interface RankGroup {
  /** Node ids forced onto the same graphviz rank (keeps binary-tree levels flat). */
  ids: string[];
}

export interface GraphModel {
  kind: StructureKind;
  directed: boolean;
  /** Rendered above the graph; usually the parameter name. */
  title?: string;
  nodes: GNode[];
  edges: GEdge[];
  ranks: RankGroup[];
  matrix?: MatrixData;
  /** Binary-tree child pointers for topology morph playback. */
  links?: TreeLinks;
  /** Non-fatal notes surfaced in the panel (e.g. "cycle at index 2"). */
  notes: string[];
}

export const KIND_LABELS: Record<StructureKind, string> = {
  "binary-tree": "Binary tree",
  "linked-list": "Linked list",
  matrix: "Graph",
};

/** Rendered element count - the size guard must see matrix cells too. */
function modelSize(model: GraphModel): number {
  if (model.matrix) {
    let cells = 0;
    for (const row of model.matrix.rows) cells += row.length;
    return cells;
  }
  return model.nodes.length;
}

export function visibleNodeCount(model: GraphModel): number {
  if (model.matrix) return modelSize(model);
  let count = 0;
  for (const node of model.nodes) {
    if (node.role !== "spine" && node.role !== "null") count += 1;
  }
  return count;
}

export function emptyModel(kind: StructureKind, title?: string): GraphModel {
  return { kind, directed: true, title, nodes: [], edges: [], ranks: [], notes: [] };
}

/** One visualizable input parameter, after recipe mapping. */
export interface Pane {
  id: string;
  title: string;
  model: GraphModel;
}

export interface ParseFailure {
  paramName: string;
  reason: string;
}

export interface ParseResult {
  panes: Pane[];
  failures: ParseFailure[];
}

export type { TreeLinks };
