import type { TreeLinks } from "./topology.js";

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
  filled: boolean;
}

export interface MatrixData {
  rows: MatrixCell[][];
  showIndices: boolean;
}

export interface RankGroup {
  ids: string[];
}

export interface GraphModel {
  kind: StructureKind;
  directed: boolean;
  title?: string;
  nodes: GNode[];
  edges: GEdge[];
  ranks: RankGroup[];
  matrix?: MatrixData;
  links?: TreeLinks;
  listGroups?: string[][];
}

export const KIND_LABELS: Record<StructureKind, string> = {
  "binary-tree": "Binary tree",
  "linked-list": "Linked list",
  matrix: "Graph",
};

export function visibleNodeCount(model: GraphModel): number {
  if (model.matrix) return model.matrix.rows.reduce((n, row) => n + row.length, 0);
  return model.nodes.filter((n) => n.role !== "spine" && n.role !== "null").length;
}

export function emptyModel(kind: StructureKind, title?: string): GraphModel {
  return { kind, directed: true, title, nodes: [], edges: [], ranks: [] };
}

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
