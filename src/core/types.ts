export type StructureKind =
  | "binary-tree"
  | "linked-list"
  | "matrix"
  | "graph";

export const STRUCTURE_KINDS: readonly StructureKind[] = ["binary-tree", "linked-list", "matrix", "graph"];

export function isStructureKind(value: unknown): value is StructureKind {
  return typeof value === "string" && STRUCTURE_KINDS.includes(value as StructureKind);
}

export type NodeRole = "normal" | "null" | "spine" | "root" | "terminal" | "title";

export interface NodeLinks {
  left?: string;
  right?: string;
  next?: string;
}

export type Links = Record<string, NodeLinks>;

export type KindChoice = StructureKind | "none";

export const PANE_IDS = "abcdefghijklmnopqrstuvwxy";

export function paneId(index: number): string | undefined {
  return index >= 0 ? PANE_IDS[index] : undefined;
}

export const NODE_ID = /^[a-z]\d+$/;

export interface GNode {
  id: string;
  label: string;
  role: NodeRole;
  matrix?: MatrixData;
}

export type EdgeRole = "normal" | "spine" | "null" | "cycle";

export interface GEdge {
  from: string;
  to: string;
  label?: string;
  role: EdgeRole;
  undirected?: boolean;
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
  links?: Links;
  listGroups?: string[][];
  engine?: "neato";
}

export const KIND_LABELS: Record<StructureKind, string> = {
  "binary-tree": "Binary tree",
  "linked-list": "Linked list",
  matrix: "Grid",
  graph: "Graph",
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
  detected: Array<StructureKind | undefined>;
}
